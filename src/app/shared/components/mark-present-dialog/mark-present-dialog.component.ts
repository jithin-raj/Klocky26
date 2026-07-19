import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkPresentDialogService, MarkPresentItem } from './mark-present-dialog.service';
import { AttendanceRequestService } from '../../../core/services/attendance-request.service';
import { LocalizationService } from '../../../core/services/localization.service';
import { ToastService } from '../ui-toast/toast.service';
import { UiTimePickerComponent } from '../ui-timepicker/ui-timepicker.component';
import { UiTextareaComponent } from '../ui-textarea/ui-textarea.component';
import { OrgDateOnlyPipe } from '../../pipes/localization.pipes';
import { MarkPresentBulkResultItem, MarkPresentRequest } from '../../../core/models/attendance-request.model';

type DialogPhase = 'form' | 'submitting' | 'results';

function itemKey(userId: string, date: string): string {
  return `${userId}|${date}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkPresentDialogComponent — mounted once (shell). Handles both single-item
// and bulk mark-present, picking the right endpoint based on item count.
// Three phases: form (pick common clock-in/out/note, review the item list) ->
// submitting -> results (per-item success/failure, retry just the failures).
// Retrying re-enters 'form' with only the failed items, so the admin can
// adjust times/note before resubmitting; the selection is never lost.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mark-present-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiTimePickerComponent, UiTextareaComponent, OrgDateOnlyPipe],
  templateUrl: './mark-present-dialog.component.html',
  styleUrl: './mark-present-dialog.component.scss',
})
export class MarkPresentDialogComponent {
  private readonly dialog = inject(MarkPresentDialogService);
  private readonly attendanceRequests = inject(AttendanceRequestService);
  private readonly loc = inject(LocalizationService);
  private readonly toast = inject(ToastService);

  readonly state = this.dialog.state;

  phase = signal<DialogPhase>('form');
  workingItems = signal<MarkPresentItem[]>([]);
  clockIn = signal('');
  clockOut = signal('');
  note = signal('');
  formError = signal('');
  results = signal<MarkPresentBulkResultItem[]>([]);

  /** Definitive outcome per item (userId|date), overwritten on retry — this is what gets resolved back to the caller. */
  private readonly _resultsByKey = new Map<string, MarkPresentBulkResultItem>();

  readonly isBulk = computed(() => this.workingItems().length > 1);
  readonly succeeded = computed(() => this.results().filter(r => r.success));
  readonly failed = computed(() => this.results().filter(r => !r.success));
  readonly failedItems = computed<MarkPresentItem[]>(() => {
    const failedKeys = new Set(this.failed().map(r => itemKey(r.userId, r.date)));
    return this.workingItems().filter(i => failedKeys.has(itemKey(i.userId, i.date)));
  });

  constructor() {
    // Reset every time a *new* dialog opens (state goes null -> non-null).
    effect(() => {
      const s = this.state();
      if (s) {
        this.phase.set('form');
        this.workingItems.set(s.items);
        this.clockIn.set('');
        this.clockOut.set('');
        this.note.set('');
        this.formError.set('');
        this.results.set([]);
        this._resultsByKey.clear();
      }
    });
  }

  removeItem(item: MarkPresentItem): void {
    if (this.workingItems().length <= 1) return;
    this.workingItems.update(list => list.filter(i => itemKey(i.userId, i.date) !== itemKey(item.userId, item.date)));
  }

  cancel(): void {
    if (this.phase() === 'submitting') return;
    this.dialog.resolve(this._resultsByKey.size ? Array.from(this._resultsByKey.values()) : null);
  }

  submit(): void {
    const items = this.workingItems();
    if (!items.length || this.phase() === 'submitting') return;

    if (this.clockIn() && this.clockOut() && this.clockOut() <= this.clockIn()) {
      this.formError.set('Clock out must be after clock in.');
      return;
    }
    this.formError.set('');
    this.phase.set('submitting');

    const buildPayload = (item: MarkPresentItem): MarkPresentRequest => ({
      userId: item.userId,
      date: item.date,
      clockIn: this.clockIn() ? this.loc.toUtcIso(item.date, this.clockIn()) : undefined,
      clockOut: this.clockOut() ? this.loc.toUtcIso(item.date, this.clockOut()) : undefined,
      note: this.note().trim() || undefined,
    });

    if (items.length === 1) {
      const item = items[0];
      this.attendanceRequests.markPresent(buildPayload(item)).subscribe({
        next: (res) => this._applyResults([{ userId: item.userId, date: item.date, success: true, message: res.message }]),
        error: (err) => this._applyResults([{
          userId: item.userId, date: item.date, success: false,
          message: err?.error?.message ?? err?.error?.error ?? 'Could not mark this day present.',
        }]),
      });
    } else {
      this.attendanceRequests.markPresentBulk({ items: items.map(buildPayload) }).subscribe({
        next: (res) => this._applyResults(res.results),
        error: (err) => {
          // Whole-request failure (e.g. network/500) — every item stays unresolved so it's retryable.
          const message = err?.error?.message ?? err?.error?.error ?? 'Could not process this request. Please try again.';
          this._applyResults(items.map(i => ({ userId: i.userId, date: i.date, success: false, message })));
        },
      });
    }
  }

  private _applyResults(results: MarkPresentBulkResultItem[]): void {
    this.results.set(results);
    for (const r of results) this._resultsByKey.set(itemKey(r.userId, r.date), r);
    this.phase.set('results');

    const succeeded = results.filter(r => r.success).length;
    const failed = results.length - succeeded;
    if (failed > 0) {
      this.toast.info('Some updates failed', `Marked ${succeeded} present, ${failed} failed.`);
    } else {
      this.toast.success('Marked present', results.length === 1 ? (results[0].message || 'Attendance updated.') : `Marked ${succeeded} present.`);
    }
  }

  retryFailed(): void {
    const items = this.failedItems();
    if (!items.length) return;
    this.workingItems.set(items);
    this.results.set([]);
    this.phase.set('form');
  }

  done(): void {
    this.dialog.resolve(Array.from(this._resultsByKey.values()));
  }
}
