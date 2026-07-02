import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Organisation (spec §10) — Org Settings lives under /settings (developed);
// Documents is not yet built.
export const organisationRoutes: Routes = [
  { path: '', redirectTo: 'documents', pathMatch: 'full' },
  { path: 'documents', component: PlaceholderPageComponent, data: { title: 'Documents' } },
];
