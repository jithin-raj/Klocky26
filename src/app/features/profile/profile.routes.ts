import { Routes } from '@angular/router';
export const profileRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/my-profile/my-profile.component').then(m => m.MyProfileComponent) },
  {
    path: 'payslips',
    // Every employee can view their own payslips regardless of the 'payroll' permission level.
    loadComponent: () => import('./pages/my-payslips/my-payslips.component').then(m => m.MyPayslipsComponent),
  },
  {
    path: 'legal',
    // Every employee needs this — it's where you view/withdraw your own DPDP
    // consent; the "publish new version" / "consent report" sections inside
    // are gated by the 'compliance' permission, not the route itself.
    loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent),
  },
];
