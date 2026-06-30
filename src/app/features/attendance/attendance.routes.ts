import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/attendance/attendance.component').then(m => m.AttendanceComponent),
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('./pages/attendance-requests/attendance-requests.component').then(m => m.AttendanceRequestsComponent),
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