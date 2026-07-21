import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// redirectToTasksGuard — the standalone attendance-requests hub and leave
// approvals page were consolidated into the unified Tasks workspace. Applied
// to their old routes so any bookmark/link that still points at them lands
// on /app/tasks instead of 404ing.
// ─────────────────────────────────────────────────────────────────────────────

export const redirectToTasksGuard: CanActivateFn = () => {
  const appState = inject(AppStateService);
  const router = inject(Router);
  return router.createUrlTree([`/${appState.orgUrlName() || 'default'}/app/tasks`]);
};
