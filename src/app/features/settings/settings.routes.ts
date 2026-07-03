import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'org-profile',
    pathMatch: 'full',
  },
  {
    path: 'org-profile',
    loadComponent: () =>
      import('./pages/org-profile/org-profile.component').then(
        (m) => m.OrgProfileComponent,
      ),
  },
  {
    path: 'leave-categories',
    loadComponent: () =>
      import('./pages/leave-categories/leave-categories.component').then(
        (m) => m.LeaveCategoriesComponent,
      ),
  },
];
