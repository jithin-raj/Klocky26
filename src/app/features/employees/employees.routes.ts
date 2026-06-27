import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/employee-list/employee-list.component').then(
        m => m.EmployeeListComponent
      ),
  },
  {
    path: 'add',
    loadComponent: () =>
      import('./pages/employee-add/employee-add.component').then(
        m => m.EmployeeAddComponent
      ),
  },
  {
    path: 'tree',
    loadComponent: () =>
      import('./pages/org-tree/org-tree.component').then(
        m => m.OrgTreeComponent
      ),
  },
  {
    path: 'org-structure',
    loadComponent: () =>
      import('./pages/org-structure/org-structure.component').then(
        m => m.OrgStructureComponent
      ),
  },
  {
    path: 'permissions',
    // Permission matrix editor needs full access (spec §2 — PUT needs level 3).
    canActivate: [permissionGuard('permissions', 3)],
    loadComponent: () =>
      import('./pages/permissions/permissions.component').then(
        m => m.PermissionsComponent
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/employee-detail/employee-detail.component').then(
        m => m.EmployeeDetailComponent
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/employee-add/employee-add.component').then(
        m => m.EmployeeAddComponent
      ),
  },
];