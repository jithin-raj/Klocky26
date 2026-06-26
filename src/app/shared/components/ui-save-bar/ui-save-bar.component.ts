import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';

// ─────────────────────────────────────────────────────────────────────────────
// UiSaveBar — floating "unsaved changes" action bar.
//
// A centred, bottom-pinned pill that appears only when a form is dirty, with
// Discard + Save actions (matching the org-settings pattern). Reusable across
// the app so every editable screen behaves the same.
//
//   <ui-save-bar
//     [visible]="isDirty()" [saving]="saving()" [saveDisabled]="form.invalid"
//     saveLabel="Save changes"
//     (discard)="resetForm()" (save)="submit()" />
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'ui-save-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="usb" role="region" aria-label="Unsaved changes">
        <span class="usb-msg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ message }}
        </span>
        <div class="usb-actions">
          <button type="button" class="usb-discard" [disabled]="saving" (click)="discard.emit()">{{ discardLabel }}</button>
          <button type="button" class="usb-save" [disabled]="saving || saveDisabled" (click)="save.emit()">
            @if (saving) { <span class="usb-spinner"></span> {{ savingLabel }} }
            @else { {{ saveLabel }} }
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .usb {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      padding: 10px 12px 10px 18px;
      display: flex;
      align-items: center;
      gap: 18px;
      box-shadow: 0 12px 44px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06);
      z-index: 5500;
      white-space: nowrap;
      animation: usb-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes usb-in {
      from { opacity: 0; transform: translateX(-50%) translateY(16px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .usb-msg {
      display: flex; align-items: center; gap: 7px;
      font-size: 13.5px; font-weight: 500; color: #64748b;
    }
    .usb-msg svg { color: #f59e0b; }
    .usb-actions { display: flex; align-items: center; gap: 8px; }
    .usb-discard {
      padding: 9px 16px; border: 1.5px solid #e2e8f0; background: transparent;
      color: #475569; border-radius: 10px; font-size: 13.5px; font-weight: 600;
      font-family: inherit; cursor: pointer; transition: background .12s, color .12s, border-color .12s;
    }
    .usb-discard:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
    .usb-discard:disabled { opacity: .5; cursor: not-allowed; }
    .usb-save {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 20px; border: none; border-radius: 10px;
      background: var(--accent, #6366f1); color: #fff;
      font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer;
      transition: filter .12s, box-shadow .12s;
      box-shadow: 0 2px 10px color-mix(in srgb, var(--accent, #6366f1) 35%, transparent);
    }
    .usb-save:hover:not(:disabled) { filter: brightness(0.93); }
    .usb-save:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
    .usb-spinner {
      width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: usb-spin .6s linear infinite;
    }
    @keyframes usb-spin { to { transform: rotate(360deg); } }

    @media (max-width: 560px) {
      .usb { left: 16px; right: 16px; transform: none; bottom: 16px; }
      @keyframes usb-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    }
  `],
})
export class UiSaveBarComponent {
  @Input() visible = false;
  @Input() saving = false;
  @Input() saveDisabled = false;
  @Input() message = 'Unsaved changes';
  @Input() saveLabel = 'Save changes';
  @Input() savingLabel = 'Saving…';
  @Input() discardLabel = 'Discard';

  @Output() save = new EventEmitter<void>();
  @Output() discard = new EventEmitter<void>();
}
