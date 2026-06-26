import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

// ─────────────────────────────────────────────────────────────────────────────
// UiConfirmDanger — strong, type-to-confirm destructive dialog. Used for
// irreversible actions like permanent employee delete (spec §4): the confirm
// button stays disabled until the user types the exact `confirmWord`.
//
//   <ui-confirm-danger
//     [open]="!!hardDeleteTarget()"
//     title="Delete permanently"
//     [message]="'This permanently removes ' + name + ' and all their data. This cannot be undone.'"
//     [confirmWord]="name" confirmLabel="Delete permanently"
//     [busy]="deleting()"
//     (confirm)="doHardDelete()" (cancel)="hardDeleteTarget.set(null)" />
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'ui-confirm-danger',
  standalone: true,
  imports: [CommonModule, FormsModule, UiModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-modal [open]="open" [title]="title" size="sm" variant="danger" [closeOnBackdrop]="!busy" (closed)="onCancel()">
      <div class="cd">
        <p class="cd-msg">{{ message }}</p>

        @if (confirmWord) {
          <label class="cd-label">Type <strong>{{ confirmWord }}</strong> to confirm</label>
          <input class="cd-input" [(ngModel)]="typed" [placeholder]="confirmWord" autocomplete="off" />
        }

        <div class="cd-actions">
          <button type="button" class="cd-btn cd-btn--ghost" [disabled]="busy" (click)="onCancel()">Cancel</button>
          <button type="button" class="cd-btn cd-btn--danger" [disabled]="busy || !canConfirm" (click)="onConfirm()">
            @if (busy) { <span class="cd-spinner"></span> }
            {{ busy ? 'Deleting…' : confirmLabel }}
          </button>
        </div>
      </div>
    </ui-modal>
  `,
  styles: [`
    :host { display: contents; }
    .cd { padding: 2px; }
    .cd-msg { margin: 0 0 16px; font-size: 13.5px; color: #475569; line-height: 1.55; }
    .cd-label { display: block; font-size: 12.5px; color: #374151; margin-bottom: 6px; }
    .cd-label strong { color: #b91c1c; font-family: ui-monospace, monospace; }
    .cd-input {
      width: 100%; box-sizing: border-box; padding: 10px 13px; margin-bottom: 18px;
      border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #1e293b; outline: none;
    }
    .cd-input:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
    .cd-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .cd-btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 10px 18px; border-radius: 10px; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: filter .15s, background .15s;
    }
    .cd-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .cd-btn--ghost { background: #f1f5f9; color: #334155; }
    .cd-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }
    .cd-btn--danger { background: #ef4444; color: #fff; box-shadow: 0 2px 10px rgba(239,68,68,.35); }
    .cd-btn--danger:hover:not(:disabled) { filter: brightness(0.95); }
    .cd-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
      animation: cd-spin .7s linear infinite;
    }
    @keyframes cd-spin { to { transform: rotate(360deg); } }
  `],
})
export class UiConfirmDangerComponent {
  @Input() open = false;
  @Input() title = 'Are you sure?';
  @Input() message = '';
  /** When set, the confirm button is disabled until the user types this exact word. */
  @Input() confirmWord = '';
  @Input() confirmLabel = 'Delete';
  @Input() busy = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  typed = '';

  get canConfirm(): boolean {
    if (!this.confirmWord) return true;
    return this.typed.trim().toLowerCase() === this.confirmWord.trim().toLowerCase();
  }

  onConfirm(): void {
    if (this.busy || !this.canConfirm) return;
    this.confirm.emit();
  }

  onCancel(): void {
    if (this.busy) return;
    this.typed = '';
    this.cancel.emit();
  }
}
