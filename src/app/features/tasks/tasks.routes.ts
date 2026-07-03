import { Routes } from '@angular/router';

export const taskRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/history/task-history.component').then(m => m.TaskHistoryComponent),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history/task-history.component').then(m => m.TaskHistoryComponent),
  },
  {
    path: 'delegation',
    loadComponent: () =>
      import('./pages/delegation/task-delegation.component').then(m => m.TaskDelegationComponent),
  },
];
