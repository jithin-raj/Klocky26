import { Routes }     from '@angular/router';
import { authGuard }   from './core/guards/auth.guard';
import { publicGuard } from './core/guards/public.guard';
import { roleGuard }   from './core/guards/role.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  // ── Public / marketing ─────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    // publicGuard: already-authenticated users skip login → dashboard
    canActivate: [publicGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.routes),
  },
  {
    path: 'register',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: 'request-demo',
    loadComponent: () =>
      import('./features/landing/pages/request-demo/request-demo.component').then(
        (m) => m.RequestDemoComponent,
      ),
  },
  {
    path: 'free-trial',
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then((m) => m.onboardingRoutes),
  },

  // ── Klocky internal admin (separate auth flow) ──────────────────────────
  {
    path: 'klocky-admin',
    loadChildren: () =>
      import('./features/klocky-admin/klocky-admin.routes').then((m) => m.klockyAdminRoutes),
  },

  // ── 404 Not Found (explicit route for guard redirects) ──────────────────
  {
    path: '404',
    loadComponent: () =>
      import('./shared/pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },

  // ── Org-scoped app routes (/:orgUrlName/app/...) ────────────────────────
  // orgUrlName, not orgSlug — see ORG_URL_NAME_INTEGRATION.md.
  {
    path: ':orgUrlName',
    children: [
      {
        path: 'app',
        // authGuard: unauthenticated → /login?returnUrl=/:orgUrlName/app/...
        canActivate: [authGuard],
        loadComponent: () =>
          import('./layout/shell/shell.component').then((m) => m.ShellComponent),
        children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.routes),
      },
      {
        path: 'employees',
        // Hidden from level-0 users (spec §1) — deep links 404; the sidebar
        // hides the link too. Admin/super_admin always pass (spec §11).
        canActivate: [permissionGuard('employees.view', 1)],
        loadChildren: () =>
          import('./features/employees/employees.routes').then((m) => m.routes),
      },
      {
        path: 'attendance',
        loadChildren: () =>
          import('./features/attendance/attendance.routes').then((m) => m.routes),
      },
      {
        path: 'ui-components',
        loadChildren: () =>
          import('./features/ui-components/ui-components.routes').then((m) => m.routes),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'hr', 'super_admin'] },
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.routes),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/profile/profile.routes').then((m) => m.profileRoutes),
      },
      {
        path: 'leaves',
        loadChildren: () =>
          import('./features/leaves/leaves.routes').then((m) => m.leaveRoutes),
      },
      {
        path: 'tasks',
        loadChildren: () =>
          import('./features/tasks/tasks.routes').then((m) => m.taskRoutes),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then((m) => m.notificationRoutes),
      },
      {
        path: 'performance',
        loadChildren: () =>
          import('./features/performance/performance.routes').then((m) => m.performanceRoutes),
      },
      {
        path: 'analytics',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'hr', 'super_admin'] },
        loadChildren: () =>
          import('./features/analytics/analytics.routes').then((m) => m.analyticsRoutes),
      },
      {
        path: 'engagement',
        loadChildren: () =>
          import('./features/engagement/engagement.routes').then((m) => m.engagementRoutes),
      },
      {
        path: 'recruitment',
        loadChildren: () =>
          import('./features/recruitment/recruitment.routes').then((m) => m.recruitmentRoutes),
      },
      {
        path: 'roles',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'super_admin'] },
        loadChildren: () =>
          import('./features/roles/roles.routes').then((m) => m.rolesRoutes),
      },
      {
        path: 'shifts',
        loadChildren: () =>
          import('./features/shifts/shifts.routes').then((m) => m.shiftRoutes),
      },
    ],
  },
      // Catch-all for invalid /:orgUrlName routes (e.g., /:orgUrlName/xyz)
      {
        path: '**',
        redirectTo: '/404',
      },
    ],
  },

  // ── Catch-all — 404 Not Found ────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () =>
      import('./shared/pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
