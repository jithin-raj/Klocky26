import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

// ─────────────────────────────────────────────────────────────────────────────
// UiFormModal — reusable create/edit dialog scaffold (org-themed).
//
// A presentational shell only: the host owns the form state, validation and the
// submit/cancel handlers. Project the fields (use UiFormGrid / UiFormField) as
// content; this renders the header, scrollable body and a busy-aware footer.
//
//   <ui-form-modal [open]="open()" title="Add department"
//                  [busy]="saving()" [submitDisabled]="form.invalid"
//                  submitLabel="Create"
//                  (submit)="save()" (cancel)="close()">
//     <ui-form-grid> … <ui-form-field …> … </ui-form-field> … </ui-form-grid>
//   </ui-form-modal>
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'ui-form-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-modal
      [open]="open"
      [title]="title"
      [size]="size"
      [closeOnBackdrop]="!busy"
      (closed)="onModalClosed()"
    >
      @if (subtitle) {
        <p class="ufm-subtitle">{{ subtitle }}</p>
      }

      <form class="ufm-form" (ngSubmit)="onSubmit()">
        <div class="ufm-body">
          <ng-content></ng-content>
        </div>

        <div class="ufm-footer">
          <button type="button" class="ufm-btn ufm-btn--ghost" [disabled]="busy" (click)="cancel.emit()">
            {{ cancelLabel }}
          </button>
          <button type="submit" class="ufm-btn ufm-btn--primary" [class.ufm-btn--danger]="variant === 'danger'"
                  [disabled]="busy || submitDisabled">
            @if (busy) { <span class="ufm-spinner"></span> }
            {{ busy ? busyLabel : submitLabel }}
          </button>
        </div>
      </form>
    </ui-modal>
  `,
  styles: [`
    :host { display: contents; }

    .ufm-subtitle {
      margin: 4px 0 0; font-size: 13.5px; color: #64748b; line-height: 1.5;
    }
    .ufm-form { display: flex; flex-direction: column; }
    .ufm-body {
      max-height: min(64vh, 620px);
      overflow-y: auto;
      margin: 4px -4px 0;
      padding: 8px 4px 2px;
    }
    .ufm-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding-top: 18px; margin-top: 6px;
      border-top: 1px solid #f1f5f9;
    }
    .ufm-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 10px; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: filter .15s, background .15s, box-shadow .15s, transform .1s;
    }
    .ufm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .ufm-btn--ghost { background: #f1f5f9; color: #334155; }
    .ufm-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }
    .ufm-btn--primary {
      background: var(--accent, #6366f1); color: #fff;
      box-shadow: 0 2px 10px color-mix(in srgb, var(--accent, #6366f1) 35%, transparent);
    }
    .ufm-btn--primary:hover:not(:disabled) { filter: brightness(0.93); }
    .ufm-btn--primary:active:not(:disabled) { transform: scale(0.99); }
    .ufm-btn--danger {
      background: #ef4444;
      box-shadow: 0 2px 10px rgba(239,68,68,.35);
    }
    .ufm-btn--danger:hover:not(:disabled) { filter: brightness(0.95); }

    .ufm-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
      animation: ufm-spin .7s linear infinite;
    }
    @keyframes ufm-spin { to { transform: rotate(360deg); } }
  `],
})
export class UiFormModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' = 'lg';
  @Input() submitLabel = 'Save';
  @Input() busyLabel = 'Saving…';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'default' | 'danger' = 'default';
  @Input() busy = false;
  @Input() submitDisabled = false;

  /** Emitted when the form is submitted (Enter or the primary button). */
  @Output() submit = new EventEmitter<void>();
  /** Emitted on Cancel, backdrop click or the header close button. */
  @Output() cancel = new EventEmitter<void>();

  onSubmit(): void {
    if (this.busy || this.submitDisabled) return;
    this.submit.emit();
  }

  onModalClosed(): void {
    if (this.busy) return;
    this.cancel.emit();
  }
}
