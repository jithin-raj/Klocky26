import { HttpInterceptorFn } from '@angular/common/http';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Header Interceptor
//
// The React-Native shell loads this SPA in a WebView and sets
// `window.__IS_MOBILE__ = true`. Tagging every request with `isMobile: true`
// lets the backend issue the long-lived (30-day) mobile token and permit
// mobile login. No-op in a normal browser.
//
// Registered AFTER authInterceptor so the Authorization header is already set;
// this only adds the extra hint header.
// ─────────────────────────────────────────────────────────────────────────────

export const mobileHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  if ((window as Window & { __IS_MOBILE__?: boolean }).__IS_MOBILE__) {
    req = req.clone({ setHeaders: { isMobile: 'true' } });
  }
  return next(req);
};
