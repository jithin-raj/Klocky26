import { Routes } from '@angular/router';
import { redirectToTasksGuard } from '../../core/guards/redirect-to-tasks.guard';

export const leaveRoutes: Routes = [
  {
    // The standalone Leave Approvals page was consolidated into the unified
    // Tasks workspace (Pending tab) — any old link/bookmark redirects there.
    path: '',
    canActivate: [redirectToTasksGuard],
    children: [],
  },
  {
    path: 'my',
    loadComponent: () =>
      import('./pages/my-leaves/my-leaves.component').then(m => m.MyLeavesComponent),
  },
];
