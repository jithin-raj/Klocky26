import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Compensation (spec §7) — upcoming; no dummy data, Coming Soon shell only.
export const compensationRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Compensation' } },
];
