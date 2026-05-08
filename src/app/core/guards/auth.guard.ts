import { inject }          from '@angular/core';
import { CanActivateFn }   from '@angular/router';
import { Router }          from '@angular/router';
import { AppStateService } from '../services/app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// AuthGuard — protects routes that require a logged-in user
//
// Apply to any route that needs authentication:
//   { path: ':orgSlug/app', component: ShellComponent, canActivate: [authGuard], ... }
//
// Validates:
//  1. User is authenticated
//  2. URL orgSlug matches the user's orgSlug (token-based validation)
//
// Redirects:
//  - Unauthenticated users → /login with returnUrl
//  - Wrong org slug → /404 (unauthorized access to different organization)
// ─────────────────────────────────────────────────────────────────────────────

export const authGuard: CanActivateFn = (route, state) => {
  const appState = inject(AppStateService);
  const router   = inject(Router);

  if (!appState.isAuthenticated()) {
    // Not authenticated - redirect to login with return URL
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Check if URL orgSlug matches stored orgSlug (token validation)
  const urlOrgSlug = route.paramMap.get('orgSlug') || route.parent?.paramMap.get('orgSlug');
  const storedOrgSlug = appState.orgSlug();

  if (urlOrgSlug && storedOrgSlug && urlOrgSlug.toLowerCase() !== storedOrgSlug.toLowerCase()) {
    // Org mismatch - user trying to access different organization's workspace
    // In production: this would be validated against the JWT token's org claim
    // Redirect to 404 (unauthorized access)
    return router.createUrlTree(['/404']);
  }

  return true;
};
