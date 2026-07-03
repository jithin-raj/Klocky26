import { Routes } from '@angular/router';

export const timeManagementRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/overview/overview.component').then(m => m.TimeOverviewComponent),
  },
];
