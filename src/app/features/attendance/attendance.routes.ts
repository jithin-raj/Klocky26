import { Routes } from '@angular/router';
import { redirectToTasksGuard } from '../../core/guards/redirect-to-tasks.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/attendance/attendance.component').then(m => m.AttendanceComponent),
  },
  {
    // The standalone regularisation/leave/approvals hub was consolidated into
    // the unified Tasks workspace — any old link/bookmark redirects there.
    path: 'requests',
    canActivate: [redirectToTasksGuard],
    children: [],
  },
  {
    path: 'geofence',
    loadComponent: () =>
      import('./pages/geofencing/geofencing.component').then(m => m.GeofencingComponent),
  },
  {
    path: 'face-scan',
    loadComponent: () =>
      import('./pages/face-scan/face-scan.component').then(m => m.FaceScanComponent),
  },
  {
    path: 'face-roster',
    loadComponent: () =>
      import('./pages/face-roster/face-roster.component').then(m => m.FaceRosterComponent),
  },
];