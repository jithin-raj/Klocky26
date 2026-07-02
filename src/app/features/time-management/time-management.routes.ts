import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Time Management (spec §2) — Overview is a consolidated employee view that is
// not yet built. Attendance & Leave have their own developed feature routes.
export const timeManagementRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Time Management Overview' } },
];
