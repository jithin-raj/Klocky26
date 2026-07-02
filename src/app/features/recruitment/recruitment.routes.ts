import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/pages/placeholder/placeholder.component';

// Recruitment (spec §8) — not yet built.
export const recruitmentRoutes: Routes = [
  { path: '', component: PlaceholderPageComponent, data: { title: 'Recruitment Overview' } },
  { path: 'interviews', component: PlaceholderPageComponent, data: { title: 'My Interviews' } },
  { path: 'refer', component: PlaceholderPageComponent, data: { title: 'Refer a Buddy' } },
  { path: 'referrals', component: PlaceholderPageComponent, data: { title: 'Referral History' } },
  { path: 'jobs', component: PlaceholderPageComponent, data: { title: 'Job Openings' } },
];
