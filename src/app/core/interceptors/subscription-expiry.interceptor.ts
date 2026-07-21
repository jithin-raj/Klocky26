import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { OrgNavigationService } from '../services/org-navigation.service';
import { SubscriptionService } from '../services/subscription.service';
import { ToastService } from '../../shared/components/ui-toast/toast.service';

// ─────────────────────────────────────────────────────────────────────────────
// subscriptionExpiryInterceptor — the hard gate.
//
// The server returns 402 { code: 'subscription_expired' } for any action blocked
// by an expired/cancelled subscription. Flip the shared expiry flag (so the
// route guard / banner / sidebar react instantly, without waiting on a
// `/org/subscription` round-trip) and bounce the admin to the org-scoped
// /billing page. Runs LAST (after errorInterceptor) so token-refresh/403 logic
// has already had its chance; the error still propagates so callers can react.
//
// GET /api/org/subscription and /org/billing/* are deliberately reachable even
// when expired, so the billing page can still load/quote/checkout without
// re-triggering this redirect.
//
// Re-entrancy guard: while the user is already ON (or actively navigating to)
// /app/billing, skip the auto-redirect entirely — otherwise EVERY background
// 402 that lands while billing's own guards resolve (e.g. authGuard's
// validate-url-name check, which isn't on the server's expired-allow-list, or
// any leftover polling/realtime-reconnect call from a previous page) fires
// ANOTHER navigate() call that cancels the in-flight one before it can settle.
// That repeated cancel/restart is what made "click Complete Subscription" look
// like it does nothing — the redirect kept getting superseded by itself.
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptionExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const orgNav = inject(OrgNavigationService);
  const subscription = inject(SubscriptionService);
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 402 && err.error?.code === 'subscription_expired') {
        // Toast once per transition into "expired" — a burst of parallel 402s
        // (e.g. several widgets loading at once) would otherwise stack toasts.
        const wasAlreadyKnown = subscription.isExpired();
        subscription.setExpired(true);

        // `validate-url-name` is authGuard's own org-ownership check, run on
        // EVERY navigation into /app/* — including the navigation to billing
        // itself. It isn't on the server's expired-allow-list, so it 402s too;
        // authGuard already fails that open (treats it as "allow"), so this
        // interceptor must not treat it as a fresh "user action blocked" event.
        const blockedCallWasBillingOrAuthCheck =
          req.url.includes('/org/subscription') ||
          req.url.includes('/org/billing') ||
          req.url.includes('/org/auth/validate-url-name');
        // router.url only updates once a navigation SUCCEEDS, so it alone would
        // miss an in-flight navigation TO billing — also check the navigation
        // Angular is currently processing (covers any other resolver/guard call
        // that might 402 mid-route, beyond the two explicit exclusions above).
        const inFlightNav = router.getCurrentNavigation();
        const navigatingToBilling = (inFlightNav?.finalUrl ?? inFlightNav?.extractedUrl)?.toString().includes('/app/billing') ?? false;
        const alreadyHeadingToBilling = router.url.includes('/app/billing') || navigatingToBilling;

        if (!blockedCallWasBillingOrAuthCheck && !alreadyHeadingToBilling) {
          if (!wasAlreadyKnown) {
            toast.error('Subscription expired', 'Please renew to continue using Klockk.');
          }
          orgNav.navigate(['app', 'billing']);
        }
      }
      return throwError(() => err);
    }),
  );
};
