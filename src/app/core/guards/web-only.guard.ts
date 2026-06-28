import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { MobileBridgeService } from '../services/mobile-bridge.service';

// ─────────────────────────────────────────────────────────────────────────────
// webOnlyGuard — blocks web-only routes inside the mobile app shell
//
// The React-Native WebView sets `window.__IS_MOBILE__ = true`
// (MobileBridgeService.isMobile). The marketing landing page, "request a demo",
// and the org self-registration / free-trial onboarding are desktop/web flows —
// the mobile app is for employees who only sign in. On mobile we skip straight
// to /login instead of rendering those. No-op in a normal browser.
// ─────────────────────────────────────────────────────────────────────────────

export const webOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const mobile = inject(MobileBridgeService);
  const router = inject(Router);
  return mobile.isMobile ? router.createUrlTree(['/login']) : true;
};
