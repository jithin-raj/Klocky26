import { Component, ChangeDetectionStrategy, inject, computed, signal, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { SubscriptionService } from '../../core/services/subscription.service';
import { OrgNavigationService } from '../../core/services/org-navigation.service';
import { AppStateService } from '../../core/services/app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// TrialBannerComponent — full-width top bar shown while the org is on a trial
// OR its subscription has expired, sitting ABOVE the header (first child of
// .main in the shell). Two variants:
//
//  • Trial   — org-accent tint, dismissible until the final stretch
//    (daysLeft <= FORCE_SHOW_DAYS), re-appears on route change/reload.
//  • Expired — red, belt-and-suspenders UI on top of the real server-side gate
//    (subscriptionExpiryInterceptor + subscriptionGuard); never dismissible.
//
// Dismissal (trial variant) is deliberately ephemeral: it only hides the bar
// for the current view, never persisted, so a trial org keeps being nudged.
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_SHOW_DAYS = 10;

@Component({
  selector: 'klocky-trial-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="tb" [class.tb--expired]="expired()">
        <!-- Animated clock — ticking hands convey "time running out". -->
        <span class="tb__clock" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line class="tb__hand tb__hand--hour" x1="12" y1="12" x2="12" y2="8"/>
            <line class="tb__hand tb__hand--min" x1="12" y1="12" x2="12" y2="6.5"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </span>

        <span class="tb__text">
          @if (expired()) {
            @if (canManageBilling()) {
              <strong>Subscription expired.</strong> Renew now to unlock Klock again.
            } @else {
              <strong>Subscription expired.</strong> Ask an admin to renew — access is locked until then.
            }
          } @else if (canManageBilling()) {
            @if (daysLeft() != null) {
              Trial ends in <strong>{{ daysLeft() }} day{{ daysLeft() === 1 ? '' : 's' }}</strong> — choose a plan to keep your features.
            } @else {
              You're on a free trial — choose a plan to keep your features.
            }
          } @else {
            @if (daysLeft() != null) {
              Your workspace trial ends in <strong>{{ daysLeft() }} day{{ daysLeft() === 1 ? '' : 's' }}</strong> — ask an admin to pick a plan so you don't lose access.
            } @else {
              Your workspace is on a free trial — an admin needs to choose a plan to keep it active.
            }
          }
        </span>

        @if (canManageBilling()) {
          <button type="button" class="tb__btn" (click)="goBilling()">{{ expired() ? 'Renew now' : 'Choose a plan' }}</button>
        }
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
      padding: 9px 20px;
      /* Full-width top strip above the header — org-accent tint by default,
         flipped to red for the expired variant via --tb-c. */
      --tb-c: var(--accent, #6366f1);
      background: color-mix(in srgb, var(--tb-c) 12%, #fff);
      border-bottom: 1px solid color-mix(in srgb, var(--tb-c) 24%, transparent);
      color: color-mix(in srgb, var(--tb-c) 82%, #0f172a);
      font-size: 13px;
    }
    .tb--expired { --tb-c: #dc2626; }
    .tb__clock { flex-shrink: 0; display: inline-flex; color: var(--tb-c); }
    .tb__clock svg { display: block; animation: tb-tilt 4s ease-in-out infinite; }
    .tb__hand { transform-box: view-box; transform-origin: 12px 12px; }
    /* Minute hand sweeps a full turn every 2s; hour hand crawls — reads as "time ticking". */
    .tb__hand--min  { animation: tb-rotate 2s linear infinite; }
    .tb__hand--hour { animation: tb-rotate 12s linear infinite; }
    @keyframes tb-rotate { to { transform: rotate(360deg); } }
    /* Subtle "impatient" wobble of the whole clock. */
    @keyframes tb-tilt {
      0%, 100% { transform: rotate(0deg); }
      45%      { transform: rotate(-9deg); }
      55%      { transform: rotate(9deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .tb__clock svg, .tb__hand { animation: none; }
    }
    .tb__text { flex: 1; min-width: 0; }
    .tb__text strong { font-weight: 750; }
    .tb__btn {
      flex-shrink: 0; padding: 6px 14px; border-radius: 8px; border: none;
      background: var(--tb-c); color: #fff; font-size: 12.5px; font-weight: 700;
      cursor: pointer; transition: filter .15s;
    }
    .tb__btn:hover { filter: brightness(.94); }
    .tb__close {
      flex-shrink: 0; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; border-radius: 7px; cursor: pointer;
      color: color-mix(in srgb, var(--tb-c) 60%, #475569); transition: background .15s;
    }
    .tb__close:hover { background: color-mix(in srgb, var(--tb-c) 14%, transparent); }
    @media (max-width: 560px) {
      .tb { flex-wrap: wrap; }
      .tb__btn { flex: 1; }
    }
  `],
})
export class TrialBannerComponent {
  private readonly subscription = inject(SubscriptionService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);

  /**
   * Only admins/HR reach billing (roleGuard on /app/billing). Employees can't
   * purchase, so they get an informational message + no CTA instead.
   */
  readonly canManageBilling = computed(() => {
    const u = this.appState.user();
    return !!(u?.isAdmin || u?.isHr || u?.role === 'super_admin');
  });

  /** In-memory only — resets to false on every reload, so the bar re-appears. */
  private readonly dismissed = signal(false);

  constructor() {
    // Re-show on every route change: a dismissal only hides it for the current view.
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(() => this.dismissed.set(false));
  }

  readonly daysLeft = computed(() => this.subscription.state()?.daysLeft ?? null);

  /**
   * True once access is actually blocked (expired/cancelled, or the optimistic
   * post-login/402 override) — belt-and-suspenders on top of the real server
   * gate. Takes priority over the trial variant below.
   */
  readonly expired = computed(() => this.subscription.isExpiredNow());

  /** In the final stretch of a trial the banner is forced back and can't be dismissed. */
  readonly forced = computed(() => {
    const d = this.daysLeft();
    return d != null && d <= FORCE_SHOW_DAYS;
  });

  /** Expired is never dismissible — it's the real gate, not a nudge. */
  readonly dismissible = computed(() => !this.expired() && !this.forced());

  readonly show = computed(() => {
    if (this.expired()) return true;
    if (this.subscription.state()?.status !== 'trial') return false;
    return this.forced() || !this.dismissed();
  });

  dismiss(): void {
    this.dismissed.set(true);
  }

  goBilling(): void {
    this.orgNav.navigate(['app', 'billing']);
  }
}
