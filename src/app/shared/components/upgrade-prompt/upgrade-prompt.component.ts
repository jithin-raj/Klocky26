import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { UpgradePromptService } from './upgrade-prompt.service';
import { OrgNavigationService } from '../../../core/services/org-navigation.service';
import { FEATURE_LABELS } from '../../../core/models/subscription.model';

// ─────────────────────────────────────────────────────────────────────────────
// UpgradePromptComponent — global "subscribe to unlock" modal. Mounted once at
// the app root; driven by UpgradePromptService.state(). Shown when a user tries
// to enable a premium feature they aren't subscribed for.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'ui-upgrade-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.state(); as s) {
      <div class="up-overlay" (click)="close()">
        <div class="up-modal" (click)="$event.stopPropagation()">
          <div class="up-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          @if (svc.state()?.mode === 'seats') {
            <h3 class="up-title">You've reached your seat limit</h3>
            <p class="up-body">
              Your current plan doesn't have room for more employees. Upgrade your
              plan or add extra seats on the billing page to keep growing your team.
            </p>
          } @else {
            <h3 class="up-title">{{ featureLabel() }} is a premium feature</h3>
            <p class="up-body">
              Upgrade your plan to enable {{ featureLabel() }} for your organisation.
              You can compare plans and add-ons on the billing page.
            </p>
          }

          <div class="up-actions">
            <button type="button" class="up-btn up-btn--ghost" (click)="close()">Not now</button>
            <button type="button" class="up-btn up-btn--primary" (click)="viewPlans()">View plans</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .up-overlay {
      position: fixed; inset: 0; z-index: 1100;
      background: rgba(15, 23, 42, .55);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      animation: up-fade .15s ease;
    }
    @keyframes up-fade { from { opacity: 0 } to { opacity: 1 } }
    .up-modal {
      background: #fff; border-radius: 18px; width: 100%; max-width: 400px;
      padding: 28px 24px 22px; text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,.2);
      animation: up-pop .2s cubic-bezier(.22,1,.36,1);
    }
    @keyframes up-pop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
    .up-icon {
      width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    }
    .up-title { margin: 0 0 8px; font-size: 17px; font-weight: 750; color: #0f172a; }
    .up-body { margin: 0 0 22px; font-size: 13.5px; line-height: 1.55; color: #64748b; }
    .up-actions { display: flex; gap: 10px; }
    .up-btn {
      flex: 1; padding: 10px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 650;
      cursor: pointer; border: 1.5px solid transparent; transition: all .15s;
    }
    .up-btn--ghost { background: #fff; color: #374151; border-color: #e5e7eb; }
    .up-btn--ghost:hover { background: #f9fafb; }
    .up-btn--primary { background: var(--accent, #6366f1); color: #fff; }
    .up-btn--primary:hover { filter: brightness(.94); }
  `],
})
export class UpgradePromptComponent {
  readonly svc = inject(UpgradePromptService);
  private readonly orgNav = inject(OrgNavigationService);

  readonly featureLabel = computed(() => {
    const code = this.svc.state()?.feature ?? '';
    return FEATURE_LABELS[code] ?? 'This feature';
  });

  close(): void {
    this.svc.close();
  }

  viewPlans(): void {
    this.svc.close();
    this.orgNav.navigate(['app', 'billing']);
  }
}
