import { inject }          from '@angular/core';
import { CanActivateFn }   from '@angular/router';
import { Router }          from '@angular/router';
import { AppStateService } from '../services/app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// PublicGuard — prevents authenticated users from accessing public pages
//
// Apply to login / register / landing routes so a logged-in user
// is immediately redirected to the app instead of seeing the login form.
//
//   { path: 'login', canActivate: [publicGuard], loadChildren: ... }
// ─────────────────────────────────────────────────────────────────────────────

export const publicGuard: CanActivateFn = (_route, _state) => {
  const appState = inject(AppStateService);
  const router   = inject(Router);

  if (!appState.isAuthenticated()) {
    return true;
  }

  // Already logged in — send to org-scoped dashboard
  const orgUrlName = appState.orgUrlName() || 'default';
  return router.createUrlTree([`/${orgUrlName}/app/dashboard`]);
};
