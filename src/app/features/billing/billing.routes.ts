import { Routes } from '@angular/router';

export const billingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./billing.component').then((m) => m.BillingComponent),
  },
];
