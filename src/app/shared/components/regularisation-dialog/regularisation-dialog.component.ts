import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegularisationDialogService } from './regularisation-dialog.service';
import { AttendanceRequestService } from '../../../core/services/attendance-request.service';
import { OfficeService } from '../../../core/services/office.service';
import { LocalizationService } from '../../../core/services/localization.service';
import { ToastService } from '../ui-toast/toast.service';
import { UiSelectComponent } from '../ui-select/ui-select.component';
import { UiTimePickerComponent } from '../ui-timepicker/ui-timepicker.component';
import { UiTextareaComponent } from '../ui-textarea/ui-textarea.component';
import { AttendanceRequestType, ATTENDANCE_REQUEST_TYPE_LABELS } from '../../../core/models/attendance-request.model';

// ─────────────────────────────────────────────────────────────────────────────
// RegularisationDialogComponent — mounted once (shell). Lets the caller raise
// an attendance regularisation request for a specific, already-known day
// (e.g. a calendar cell) without leaving the page. The date itself is fixed —
// eligibility (locked cycle / existing request / future date) is the caller's
// responsibility to check *before* opening this dialog (the attendance
// calendar already does, via regularizeBlockedReason()).
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-regularisation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiTimePickerComponent, UiTextareaComponent],
  templateUrl: './regularisation-dialog.component.html',
  styleUrl: './regularisation-dialog.component.scss',
})
export class RegularisationDialogComponent {
  private readonly dialog = inject(RegularisationDialogService);
  private readonly attendanceRequests = inject(AttendanceRequestService);
  private readonly officeSvc = inject(OfficeService);
  private readonly loc = inject(LocalizationService);
  private readonly toast = inject(ToastService);

  readonly state = this.dialog.state;

  readonly typeOptions: { label: string; value: AttendanceRequestType }[] =
    (Object.keys(ATTENDANCE_REQUEST_TYPE_LABELS) as AttendanceRequestType[])
      .map(v => ({ label: ATTENDANCE_REQUEST_TYPE_LABELS[v], value: v }));

  officeOptions = signal<{ label: string; value: string }[]>([{ label: 'No specific office', value: '' }]);

  type       = signal<AttendanceRequestType>('missed_punch');
  clockIn    = signal('09:00');
  clockOut   = signal('18:30');
  officeId   = signal('');
  reason     = signal('');
  submitting = signal(false);
  formError  = signal('');

  private _officesLoaded = false;

  constructor() {
    // Reset every time a *new* dialog opens (state goes null -> non-null).
    effect(() => {
      const s = this.state();
      if (s) {
        this.type.set('missed_punch');
        this.clockIn.set('09:00');
        this.clockOut.set('18:30');
        this.officeId.set('');
        this.reason.set('');
        this.formError.set('');
        this.submitting.set(false);
        if (!this._officesLoaded) this._loadOffices();
      }
    });
  }

  private _loadOffices(): void {
    this._officesLoaded = true;
    this.officeSvc.getAll().subscribe({
      next: (res) => {
        const offices = res.data ?? [];
        this.officeOptions.set([{ label: 'No specific office', value: '' }, ...offices.map(o => ({ label: o.name, value: o.id }))]);
      },
      error: () => {},
    });
  }

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (this.type() === 'wfh') return true;
    return !!this.clockIn();
  });

  cancel(): void {
    if (this.submitting()) return;
    this.dialog.resolve(false);
  }

  submit(): void {
    const s = this.state();
    if (!s || !this.canSubmit()) return;

    if (this.clockIn() && this.clockOut() && this.clockOut() <= this.clockIn()) {
      this.formError.set('Clock out must be after clock in.');
      return;
    }
    this.formError.set('');
    this.submitting.set(true);

    const type = this.type();
    this.attendanceRequests.create({
      date: s.date,
      type,
      clockIn: type !== 'wfh' ? this.loc.toUtcIso(s.date, this.clockIn()) : undefined,
      clockOut: type !== 'wfh' ? this.loc.toUtcIso(s.date, this.clockOut()) : undefined,
      officeId: this.officeId() || undefined,
      reason: this.reason().trim() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Request submitted', 'Your attendance request is awaiting approval.');
        this.dialog.resolve(true);
      },
      error: (err) => {
        this.submitting.set(false);
        const status = err?.status;
        const msg = err?.error?.message ?? err?.error?.error;
        if (status === 409) {
          this.toast.error('Request not allowed', msg ?? 'A request already exists for this day, or the period is closed.');
        } else if (status === 403) {
          this.toast.error('Not permitted', msg ?? 'You do not have permission for this action.');
        } else {
          this.toast.error('Could not submit', msg ?? 'Please try again.');
        }
      },
    });
  }
}
