import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// dashboardRedirectGuard — sends admins/managers/hr to the admin dashboard,
// leaves regular employees on the employee dashboard.
//
// Applied to the '' (employee) child of dashboard.routes.ts so the single
// "Dashboard" link everywhere (login, header, sidebar) always lands the user
// on the right screen for their role without any call site needing to know
// the difference.
// ─────────────────────────────────────────────────────────────────────────────

export const dashboardRedirectGuard: CanActivateFn = () => {
  const appState = inject(AppStateService);
  const router    = inject(Router);

  const user = appState.user();
  if (user && (user.isAdmin || user.isManager || user.isHr)) {
    return router.createUrlTree([`/${appState.orgUrlName()}/app/dashboard/admin`]);
  }
  return true;
};
