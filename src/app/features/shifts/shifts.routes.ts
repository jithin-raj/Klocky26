import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Shifts & Roster (spec §10) — not yet built.
export const shiftRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Shifts & Roster' } },
];
