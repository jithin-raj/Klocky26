import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

// ─────────────────────────────────────────────────────────────────────────────
// TempPasswordDialog — shows a one-time generated/temporary password with a
// copy-to-clipboard action (angular-implementation-spec.md §5). The password is
// not refetchable, so this is the only chance to capture it.
//
//   <app-temp-password-dialog
//     [open]="!!tempPassword()" [password]="tempPassword()!"
//     [employeeName]="target()?.fullName ?? ''"
//     (closed)="tempPassword.set(null)" />
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-temp-password-dialog',
  standalone: true,
  imports: [CommonModule, UiModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-modal [open]="open" title="Temporary password" size="sm" [closeOnBackdrop]="true" (closed)="close()">
      <div class="tpd">
        <p class="tpd-sub">
          @if (employeeName) {
            A new password was generated for <strong>{{ employeeName }}</strong>. Share it securely —
          } @else {
            Password generated successfully. Share it securely —
          }
          it won't be shown again.
        </p>

        <div class="tpd-box">
          <code class="tpd-code">{{ password }}</code>
          <button type="button" class="tpd-copy" (click)="copy()" [class.tpd-copy--done]="copied()">
            @if (copied()) {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Copied
            } @else {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            }
          </button>
        </div>

        <p class="tpd-note">The employee must change it on next login.</p>

        <button type="button" class="tpd-done" (click)="close()">Done</button>
      </div>
    </ui-modal>
  `,
  styles: [`
    :host { display: contents; }
    .tpd { padding: 4px 2px 2px; text-align: center; }
    .tpd-sub { margin: 0 0 16px; font-size: 13.5px; color: #475569; line-height: 1.55; }
    .tpd-sub strong { color: #0f172a; }
    .tpd-box {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 8px 8px 14px;
      border: 1.5px dashed color-mix(in srgb, var(--accent, #6366f1) 40%, #e5e7eb);
      border-radius: 12px;
      background: color-mix(in srgb, var(--accent, #6366f1) 5%, #fff);
    }
    .tpd-code {
      flex: 1; text-align: left;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a;
      overflow-x: auto; white-space: nowrap;
    }
    .tpd-copy {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 13px; border-radius: 9px; border: none;
      background: var(--accent, #6366f1); color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0;
      transition: filter .15s, background .15s;
    }
    .tpd-copy:hover { filter: brightness(0.93); }
    .tpd-copy--done { background: #16a34a; }
    .tpd-note { margin: 14px 0 18px; font-size: 12px; color: #94a3b8; }
    .tpd-done {
      width: 100%; padding: 11px; border: none; border-radius: 11px;
      background: #f1f5f9; color: #334155; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .tpd-done:hover { background: #e2e8f0; }
  `],
})
export class TempPasswordDialogComponent {
  @Input() open = false;
  @Input() password = '';
  @Input() employeeName = '';
  @Output() closed = new EventEmitter<void>();

  readonly copied = signal(false);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch { /* clipboard blocked — user can still select the text */ }
  }

  close(): void {
    this.copied.set(false);
    this.closed.emit();
  }
}
