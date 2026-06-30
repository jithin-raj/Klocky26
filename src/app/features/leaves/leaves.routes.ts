import { Routes } from '@angular/router';

export const leaveRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/leave-approvals/leave-approvals.component').then(m => m.LeaveApprovalsComponent),
  },
  {
    path: 'my',
    loadComponent: () =>
      import('./pages/my-leaves/my-leaves.component').then(m => m.MyLeavesComponent),
  },
];
