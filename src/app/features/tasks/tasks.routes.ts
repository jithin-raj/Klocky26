import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Task Box (spec §3) — not yet built. Sub-routes render the shared Coming Soon
// page; each sets its own title via route data (bound through
// withComponentInputBinding()).
export const taskRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Task List' } },
  { path: 'history', component: PlaceholderPageComponent, data: { title: 'Task History' } },
  { path: 'delegation', component: PlaceholderPageComponent, data: { title: 'Manage Delegation' } },
];
