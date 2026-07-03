import { Routes } from '@angular/router';

export const performanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/appraisals/appraisals.component').then(m => m.AppraisalsComponent),
  },
  {
    path: 'appraisals',
    loadComponent: () =>
      import('./pages/appraisals/appraisals.component').then(m => m.AppraisalsComponent),
  },
  {
    path: 'pay-scale',
    loadComponent: () =>
      import('./pages/pay-scale/pay-scale.component').then(m => m.PayScaleComponent),
  },
  {
    path: 'assessments',
    loadComponent: () =>
      import('./pages/assessments/assessments.component').then(m => m.AssessmentsComponent),
  },
];
