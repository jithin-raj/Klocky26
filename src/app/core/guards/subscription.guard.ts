import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { SubscriptionService } from '../services/subscription.service';
import { OrgNavigationService } from '../services/org-navigation.service';

// ─────────────────────────────────────────────────────────────────────────────
// subscriptionGuard — keeps an expired org pinned to /billing.
//
// Applied as `canActivateChild` on the org-scoped 'app' route (alongside
// authGuard), so it re-checks on EVERY child navigation — not just once like
// the shell's own first-load redirect in ShellComponent.ngOnInit. This is UI
// convenience only — the server's 402 (via subscriptionExpiryInterceptor) is
// the real, ongoing gate.
//
// IMPORTANT: canActivateChild re-fires for EVERY level of the activated route
// tree under 'app' — including billing's own nested default child (billing
// .routes has `{ path: '' }`). Checking only the immediate segment
// (`childRoute.routeConfig?.path === 'billing'`) would pass for the top-level
// 'billing' activation but FAIL for that nested '' child, redirecting back
// into billing and creating an infinite redirect loop. So match on the
// navigating URL instead — that's true for every level inside /app/billing/*.
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptionGuard: CanActivateChildFn = (_childRoute, state) => {
  const subscription = inject(SubscriptionService);
  const orgNav = inject(OrgNavigationService);
  const router = inject(Router);

  if (/\/app\/billing(\/|$|\?)/.test(state.url)) return true;
  if (!subscription.isExpired()) return true;

  return router.parseUrl(orgNav.getOrgUrl(['app', 'billing']));
};
