import { Routes } from '@angular/router';
export const profileRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/my-profile/my-profile.component').then(m => m.MyProfileComponent) },
  {
    path: 'payslips',
    // Every employee can view their own payslips regardless of the 'payroll' permission level.
    loadComponent: () => import('./pages/my-payslips/my-payslips.component').then(m => m.MyPayslipsComponent),
  },
];
