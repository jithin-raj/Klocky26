import { Routes } from '@angular/router';

export const recruitmentRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/interviews/interviews.component').then(m => m.InterviewsComponent),
  },
  {
    path: 'interviews',
    loadComponent: () => import('./pages/interviews/interviews.component').then(m => m.InterviewsComponent),
  },
  {
    path: 'refer',
    loadComponent: () => import('./pages/refer/refer.component').then(m => m.ReferComponent),
  },
  {
    path: 'referrals',
    loadComponent: () => import('./pages/referrals/referrals.component').then(m => m.ReferralsComponent),
  },
  {
    path: 'jobs',
    loadComponent: () => import('./pages/jobs/jobs.component').then(m => m.JobsComponent),
  },
];
