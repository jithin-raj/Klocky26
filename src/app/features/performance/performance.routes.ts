import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Performance (spec §9) — not yet built.
export const performanceRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Performance Overview' } },
  { path: 'appraisals', component: PlaceholderPageComponent, data: { title: 'Appraisals' } },
  { path: 'pay-scale', component: PlaceholderPageComponent, data: { title: 'Pay Scale' } },
  { path: 'assessments', component: PlaceholderPageComponent, data: { title: 'Assessments' } },
];
