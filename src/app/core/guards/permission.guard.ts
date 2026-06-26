import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PermissionService } from '../services/permission.service';
import { AppStateService } from '../services/app-state.service';
import { AccessLevel } from '../models/permission.model';

// ─────────────────────────────────────────────────────────────────────────────
// permissionGuard — angular-implementation-spec.md §1
//
// Route-level access gate keyed off the resolved /api/permissions/me map.
// Ensures the map is loaded (handles hard refresh / deep links) before deciding.
// Redirects to /404 on insufficient access, mirroring role.guard.ts.
//
//   {
//     path: 'permissions',
//     canActivate: [permissionGuard('permissions.manage', 3)],
//     loadComponent: ...
//   }
// ─────────────────────────────────────────────────────────────────────────────

export function permissionGuard(key: string, minLevel: AccessLevel = 1): CanActivateFn {
  return () => {
    const permissions = inject(PermissionService);
    const appState = inject(AppStateService);
    const router = inject(Router);

    const decide = () => permissions.can(key, minLevel) ? true : router.createUrlTree(['/404']);

    // Map already resolved, or no session to resolve it from — decide now.
    if (permissions.loaded() || !appState.isAuthenticated()) {
      return decide();
    }

    // Deep link before login flow ran load() — resolve /me first.
    return permissions.load().pipe(
      map(() => decide()),
      catchError(() => of(router.createUrlTree(['/404']))),
    );
  };
}
