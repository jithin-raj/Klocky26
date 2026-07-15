import { Routes } from '@angular/router';
import { platformAdminGuard } from '../../core/guards/platform-admin.guard';

export const klockyAdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/admin-login/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [platformAdminGuard],
    loadComponent: () =>
      import('./layout/admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'organisations',
        loadComponent: () =>
          import('./pages/admin-organisations/admin-organisations.component').then(m => m.AdminOrganisationsComponent),
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./pages/admin-catalog/admin-catalog.component').then(m => m.AdminCatalogComponent),
      },
      {
        path: 'options',
        loadComponent: () =>
          import('./pages/admin-options/admin-options.component').then(m => m.AdminOptionsComponent),
      },
      {
        path: 'demo-requests',
        loadComponent: () =>
          import('./pages/admin-demo-requests/admin-demo-requests.component').then(m => m.AdminDemoRequestsComponent),
      },
    ],
  },
];
