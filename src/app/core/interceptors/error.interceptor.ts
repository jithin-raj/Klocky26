import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject }                               from '@angular/core';
import { Router }                               from '@angular/router';
import { catchError, switchMap, throwError, from } from 'rxjs';
import { AppStateService }                      from '../services/app-state.service';
import { UserAuthService }                      from '../services/user-auth.service';
import { AUTH_SCOPE }                           from '../http/auth-scope.context';

// ─────────────────────────────────────────────────────────────────────────────
// Error Interceptor
//
// Handles HTTP error responses globally:
//
//  401 Unauthorized (AUTH_SCOPE 'user' only)
//    → Attempt a silent employee-token refresh (one retry)
//    → If refresh fails, clear the session (keep org identity) and redirect to /login
//    → For 'org'/'platform' scope, the step-up session simply expired — there
//      is no refresh token for those, so the error just propagates and the
//      caller re-prompts for a password.
//
//  403 Forbidden
//    → Redirect to /404 (user is authenticated but lacks permission)
//
//  404 Not Found
//    → Pass through — let the calling service/component handle it
//
//  422 Unprocessable Entity (validation errors)
//    → Pass through — let the form component handle field-level errors
//
//  5xx Server Error
//    → Re-throw with a user-friendly message for the global toast handler
//
//  Network error (status 0)
//    → Re-throw with "No internet connection" message
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks whether a refresh is in progress to prevent infinite loops */
let isRefreshing = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const appState   = inject(AppStateService);
  const userAuth   = inject(UserAuthService);
  const router     = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      // ── Network / CORS error ───────────────────────────────────────────────
      if (error.status === 0) {
        return throwError(() => ({
          ...error,
          userMessage: 'Network error — please check your connection.',
        }));
      }

      // ── 401 Unauthorized — try silent token refresh (employee scope only) ──
      const scope = req.context.get(AUTH_SCOPE);
      if (error.status === 401 && scope === 'user' && !isRefreshing) {
        isRefreshing = true;

        return userAuth.refreshToken().pipe(
          switchMap(() => {
            isRefreshing = false;

            // Retry the original request with the new token
            const newToken = appState.getAccessTokenSync();
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            // Refresh also failed (refresh token itself expired/invalid) —
            // force logout, but keep org identity so /login can skip the
            // "which org" step. Only a manual logout wipes that.
            isRefreshing = false;
            return from(appState.clearSession()).pipe(
              switchMap(() => {
                router.navigate(['/login']);
                return throwError(() => refreshError);
              }),
            );
          }),
        );
      }

      // ── 403 Forbidden ──────────────────────────────────────────────────────
      // Do NOT globally redirect to /404 here: route-level access is already
      // gated by permissionGuard/roleGuard before a page loads, so a 403 at this
      // point is an individual API call being denied (often an auxiliary one like
      // GET /departments on the employee list). Nuking the whole SPA to /404 for
      // that hid pages that were otherwise fine. Surface a message and let the
      // calling component handle it inline (loading/error states already exist).
      if (error.status === 403) {
        return throwError(() => ({
          ...error,
          userMessage: 'You do not have permission to access this resource.',
        }));
      }

      // ── 5xx Server errors ──────────────────────────────────────────────────
      if (error.status >= 500) {
        return throwError(() => ({
          ...error,
          userMessage: 'Something went wrong on our end. Please try again shortly.',
        }));
      }

      // ── All other errors (402, 404, 409, 422, 429, etc.) — pass through ────
      // 409 in particular carries the exact server-side message (e.g. geofence
      // distance, "already clocked in") in error.error.message — surface it
      // verbatim in the calling component rather than a generic toast.
      return throwError(() => error);
    }),
  );
};
