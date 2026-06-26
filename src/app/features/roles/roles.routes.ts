import { Routes } from '@angular/router';

// Roles & Permissions is the API-backed permission-matrix editor (the new spec's
// §2 radio editor). The previous hardcoded boolean matrix was replaced — this
// route now serves the real editor (also reachable at app/employees/permissions).
export const rolesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../employees/pages/permissions/permissions.component').then(m => m.PermissionsComponent),
  },
];
