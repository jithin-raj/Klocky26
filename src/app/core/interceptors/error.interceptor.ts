import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject }                               from '@angular/core';
import { Router }                               from '@angular/router';
import { catchError, switchMap, throwError, from } from 'rxjs';
import { AppStateService }                      from '../services/app-state.service';
import { AuthService }                          from '../services/auth.service';

// ─────────────────────────────────────────────────────────────────────────────
// Error Interceptor
//
// Handles HTTP error responses globally:
//
//  401 Unauthorized
//    → Attempt a silent token refresh (one retry)
//    → If refresh fails, clear state and redirect to /login
//
//  403 Forbidden
//    → Redirect to /app/dashboard (user is authenticated but lacks permission)
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
  const authSvc    = inject(AuthService);
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

      // ── 401 Unauthorized — try silent token refresh ────────────────────────
      if (error.status === 401 && !isRefreshing) {
        isRefreshing = true;

        return authSvc.refreshToken().pipe(
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
            // Refresh also failed — force logout
            isRefreshing = false;
            return from(appState.clearState()).pipe(
              switchMap(() => {
                router.navigate(['/login']);
                return throwError(() => refreshError);
              }),
            );
          }),
        );
      }

      // ── 403 Forbidden ──────────────────────────────────────────────────────
      if (error.status === 403) {
        // Unauthorized access - redirect to 404
        router.navigate(['/404']);
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

      // ── All other errors (404, 422, 429, etc.) — pass through ──────────────
      return throwError(() => error);
    }),
  );
};
