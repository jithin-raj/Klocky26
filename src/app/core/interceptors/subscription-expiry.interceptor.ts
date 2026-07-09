import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { OrgNavigationService } from '../services/org-navigation.service';

// ─────────────────────────────────────────────────────────────────────────────
// subscriptionExpiryInterceptor — the hard gate.
//
// The server returns 402 { code: 'subscription_expired' } for any action blocked
// by an expired/cancelled subscription. Bounce the admin to the org-scoped
// /billing page. Runs LAST (after errorInterceptor) so token-refresh/403 logic
// has already had its chance; the error still propagates so callers can react.
//
// GET /api/org/subscription is deliberately reachable even when expired, so the
// billing page can still load its own state without re-triggering this redirect.
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptionExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const orgNav = inject(OrgNavigationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 402 && err.error?.code === 'subscription_expired') {
        // Don't loop if the blocked call was billing/subscription itself.
        if (!req.url.includes('/org/subscription') && !req.url.includes('/org/billing')) {
          orgNav.navigate(['app', 'billing']);
        }
      }
      return throwError(() => err);
    }),
  );
};
