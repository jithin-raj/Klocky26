import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { SubscriptionService } from '../../core/services/subscription.service';
import { OrgNavigationService } from '../../core/services/org-navigation.service';

// ─────────────────────────────────────────────────────────────────────────────
// TrialBannerComponent — persistent banner shown while the org is on a trial.
//
// Dismissible by the user, but once the trial hits its final stretch
// (daysLeft <= FORCE_SHOW_DAYS) it re-appears and can no longer be dismissed.
// Dismissal is remembered in localStorage so it stays hidden across reloads
// until the force-show window kicks in.
//
// Styling is org-themed and translucent — it tints with the shell's --accent
// rather than a fixed brand colour.
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_SHOW_DAYS = 10;
const DISMISS_KEY = 'klocky_trial_banner_dismissed';

@Component({
  selector: 'klocky-trial-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="tb">
        <svg class="tb__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="tb__text">
          @if (daysLeft() != null) {
            Trial ends in <strong>{{ daysLeft() }} day{{ daysLeft() === 1 ? '' : 's' }}</strong> — choose a plan to keep your features.
          } @else {
            You're on a free trial — choose a plan to keep your features.
          }
        </span>
        <button type="button" class="tb__btn" (click)="goBilling()">Choose a plan</button>
        @if (dismissible()) {
          <button type="button" class="tb__close" (click)="dismiss()" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .tb {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin: 0 0 6px;
      border-radius: 12px;
      /* Translucent org-accent tint — reads on the light content area, adopts
         each org's theme via the shell's --accent variable. */
      background: color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent, #6366f1) 26%, transparent);
      color: color-mix(in srgb, var(--accent, #6366f1) 78%, #0f172a);
      font-size: 13px;
      backdrop-filter: blur(2px);
    }
    .tb__icon { flex-shrink: 0; color: var(--accent, #6366f1); }
    .tb__text { flex: 1; min-width: 0; }
    .tb__text strong { font-weight: 750; }
    .tb__btn {
      flex-shrink: 0; padding: 6px 14px; border-radius: 8px; border: none;
      background: var(--accent, #6366f1); color: #fff; font-size: 12.5px; font-weight: 700;
      cursor: pointer; transition: filter .15s;
    }
    .tb__btn:hover { filter: brightness(.94); }
    .tb__close {
      flex-shrink: 0; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; border-radius: 7px; cursor: pointer;
      color: color-mix(in srgb, var(--accent, #6366f1) 60%, #475569); transition: background .15s;
    }
    .tb__close:hover { background: color-mix(in srgb, var(--accent, #6366f1) 14%, transparent); }
    @media (max-width: 560px) {
      .tb { flex-wrap: wrap; }
      .tb__btn { flex: 1; }
    }
  `],
})
export class TrialBannerComponent {
  private readonly subscription = inject(SubscriptionService);
  private readonly orgNav = inject(OrgNavigationService);

  private readonly dismissed = signal(this.readDismissed());

  readonly daysLeft = computed(() => this.subscription.state()?.daysLeft ?? null);

  /** In the final stretch the banner is forced back and can't be dismissed. */
  readonly forced = computed(() => {
    const d = this.daysLeft();
    return d != null && d <= FORCE_SHOW_DAYS;
  });

  readonly dismissible = computed(() => !this.forced());

  readonly show = computed(() => {
    if (this.subscription.state()?.status !== 'trial') return false;
    return this.forced() || !this.dismissed();
  });

  dismiss(): void {
    this.dismissed.set(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — session-only */ }
  }

  goBilling(): void {
    this.orgNav.navigate(['app', 'billing']);
  }

  private readDismissed(): boolean {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  }
}
