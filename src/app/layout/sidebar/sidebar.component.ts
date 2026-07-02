import { Component, Input, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { UiIconComponent } from '../../shared/components';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';
import { UserAuthService } from '../../core/services/user-auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { UserRole } from '../../core/models/user.model';
import { AccessLevel } from '../../core/models/permission.model';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  /** Omit to show to everyone. Matches the roles used by the route's own roleGuard, where one exists. */
  roles?: UserRole[];
  /** Optional permission gate (spec §1) — hidden unless the resolved /me level for this key ≥ permLevel. */
  permKey?: string;
  permLevel?: AccessLevel;
  /** Feature not yet built — link routes to the shared Coming Soon page and shows a "Soon" badge. */
  comingSoon?: boolean;
}

interface MenuSection {
  id: string;
  label: string;
  icon: string;
  expanded: boolean;
  items: MenuItem[];
}

const MANAGEMENT_ROLES: UserRole[] = ['admin', 'hr', 'manager', 'super_admin'];
const ADMIN_HR_ROLES: UserRole[] = ['admin', 'hr', 'super_admin'];
const ADMIN_ONLY_ROLES: UserRole[] = ['admin', 'super_admin'];
/** Personal/employee-facing items — hidden for org admins who manage others, not themselves */
const NON_ADMIN_ROLES: UserRole[] = ['employee', 'hr', 'manager'];

@Component({
  selector: 'klocky-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    UiIconComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() isOpen = false;

  private router    = inject(Router);
  private orgTheme  = inject(OrgThemeService);
  private appState  = inject(AppStateService);
  private userAuth  = inject(UserAuthService);
  private permissions = inject(PermissionService);

  // Track current URL reactively
  currentUrl = signal<string>(this.router.url);

  // Org-scoped route prefix
  orgPrefix = computed(() => `/${this.appState.orgUrlName() || 'default'}`);

  // Dashboard promoted to a standalone top-level link (no "Main" group).
  // '/app/dashboard' redirects admins/managers/hr to the admin dashboard
  // automatically (dashboardRedirectGuard) — one link covers both.
  dashboardLink = computed(() => `${this.orgPrefix()}/app/dashboard`);

  // State for expanded sections - initially empty, sections expand on click or when they have active routes
  expandedSections = signal<Set<string>>(new Set());

  constructor() {
    // Update currentUrl signal whenever navigation completes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

  // Menu structure with sections (routes without org prefix - added dynamically).
  // `roles` on an item mirrors that route's own roleGuard data (app.routes.ts) —
  // this only hides the link, it isn't the security boundary; the guard is.
  // Menu structure follows the 10-section product spec. Items flagged
  // `comingSoon` route to the shared Coming Soon page and render a "Soon" badge;
  // they are still role/permission gated, so users without access don't see them
  // at all (per requirement: "if there is no access hide it completely").
  private baseMenuSections: MenuSection[] = [
    // §2 — Time Management
    {
      id: 'time',
      label: 'Time Management',
      icon: 'clock',
      expanded: false,
      items: [
        { label: 'Overview', route: 'app/time-management', icon: 'grid', exact: true, comingSoon: true },
        { label: 'Attendance', route: 'app/attendance', icon: 'calendar', exact: true, roles: NON_ADMIN_ROLES },
        { label: 'Regularization', route: 'app/attendance/requests', icon: 'repeat', roles: NON_ADMIN_ROLES },
        { label: 'My Leave', route: 'app/leaves/my', icon: 'calendar', roles: NON_ADMIN_ROLES },
        { label: 'Leave Approvals', route: 'app/leaves', icon: 'check-circle', exact: true, roles: MANAGEMENT_ROLES },
        { label: 'Face Scan', route: 'app/attendance/face-scan', icon: 'scan', roles: NON_ADMIN_ROLES },
      ]
    },
    // §3 — Task Box (not yet built)
    {
      id: 'tasks',
      label: 'Task Box',
      icon: 'clipboard-check',
      expanded: false,
      items: [
        { label: 'Task List', route: 'app/tasks', icon: 'clipboard-check', exact: true, comingSoon: true },
        { label: 'Task History', route: 'app/tasks/history', icon: 'layers', comingSoon: true },
        { label: 'Manage Delegation', route: 'app/tasks/delegation', icon: 'repeat', roles: MANAGEMENT_ROLES, comingSoon: true },
      ]
    },
    // §4 — Org View
    {
      id: 'org',
      label: 'Org View',
      icon: 'tree',
      expanded: false,
      items: [
        // View-only org structure — visible to anyone with employees view access (level 1).
        { label: 'Org Tree', route: 'app/employees/tree', icon: 'tree', permKey: 'employees', permLevel: 1 },
      ]
    },
    // §5 + §6 — Employee Management (incl. Roles & Permissions)
    {
      id: 'people',
      label: 'Employee Management',
      icon: 'users',
      expanded: false,
      items: [
        { label: 'Employees', route: 'app/employees', icon: 'users', exact: true, roles: MANAGEMENT_ROLES, permKey: 'employees', permLevel: 1 },
        { label: 'Departments & Roles', route: 'app/employees/org-structure', icon: 'sitemap', roles: ADMIN_ONLY_ROLES },
        { label: 'Roles & Permissions', route: 'app/roles', icon: 'shield', roles: ADMIN_ONLY_ROLES, permKey: 'permissions', permLevel: 3 },
      ]
    },
    // §7 — Compensation (upcoming)
    {
      id: 'compensation',
      label: 'Compensation',
      icon: 'briefcase',
      expanded: false,
      items: [
        { label: 'Compensation', route: 'app/compensation', icon: 'briefcase', exact: true, roles: MANAGEMENT_ROLES, comingSoon: true },
      ]
    },
    // §8 — Recruitment (not yet built)
    {
      id: 'recruitment',
      label: 'Recruitment',
      icon: 'user-plus',
      expanded: false,
      items: [
        { label: 'Overview', route: 'app/recruitment', icon: 'user-plus', exact: true, roles: ADMIN_HR_ROLES, comingSoon: true },
        { label: 'My Interviews', route: 'app/recruitment/interviews', icon: 'user-check', comingSoon: true },
        { label: 'Refer a Buddy', route: 'app/recruitment/refer', icon: 'megaphone', comingSoon: true },
        { label: 'Referral History', route: 'app/recruitment/referrals', icon: 'layers', comingSoon: true },
        { label: 'Job Openings', route: 'app/recruitment/jobs', icon: 'briefcase', comingSoon: true },
      ]
    },
    // §9 — Performance (not yet built)
    {
      id: 'performance',
      label: 'Performance',
      icon: 'bar-chart',
      expanded: false,
      items: [
        { label: 'Overview', route: 'app/performance', icon: 'bar-chart', exact: true, comingSoon: true },
        { label: 'Appraisals', route: 'app/performance/appraisals', icon: 'award', comingSoon: true },
        { label: 'Pay Scale', route: 'app/performance/pay-scale', icon: 'pie-chart', roles: ADMIN_HR_ROLES, comingSoon: true },
        { label: 'Assessments', route: 'app/performance/assessments', icon: 'clipboard-check', comingSoon: true },
      ]
    },
    // §10 — Organisation
    {
      id: 'organisation',
      label: 'Organisation',
      icon: 'building',
      expanded: false,
      items: [
        { label: 'Org Settings', route: 'app/settings', icon: 'settings', roles: ADMIN_HR_ROLES },
        { label: 'Documents', route: 'app/organisation/documents', icon: 'layers', comingSoon: true },
        { label: 'Shifts & Roster', route: 'app/shifts', icon: 'repeat', roles: MANAGEMENT_ROLES, comingSoon: true },
        { label: 'Geo-fencing', route: 'app/attendance/geofence', icon: 'map-pin', roles: ADMIN_ONLY_ROLES },
        { label: 'Send Notification', route: 'app/notifications', icon: 'send', roles: MANAGEMENT_ROLES },
      ]
    },
  ];

  /** Settings only shows for the roles that can actually pass settings' own roleGuard. */
  readonly showSettings = computed(() => {
    const role = this.appState.userRole();
    return !!role && ADMIN_HR_ROLES.includes(role);
  });

  // Computed menu sections with org-scoped routes, filtered by the current role.
  // Sections with no visible items after filtering are dropped entirely.
  menuSections = computed(() => {
    const prefix = this.orgPrefix();
    const role = this.appState.userRole();

    // Touch permission signals so the menu recomputes once /me resolves.
    this.permissions.loaded();
    this.permissions.isAdmin();

    return this.baseMenuSections
      .map(section => ({
        ...section,
        items: section.items
          .filter(item => !item.roles || (role && item.roles.includes(role)))
          // Permission gate (spec §1): when a key is set, hide unless the
          // resolved access level meets it. Admin/super_admin always pass.
          .filter(item => !item.permKey || this.permissions.can(item.permKey, item.permLevel ?? 1))
          .map(item => ({ ...item, route: `${prefix}/${item.route}` })),
      }))
      .filter(section => section.items.length > 0);
  });

  /** Locks the sidebar open and shows all sections expanded */
  allOpen = signal(false);

  toggleAllOpen(): void {
    this.allOpen.update(v => !v);
    // Reset manual section state when toggling the all-open view
    this.expandedSections.set(new Set());
  }

  toggleSection(sectionId: string): void {
    // Exit all-open mode when user manually picks a section
    this.allOpen.set(false);
    const expanded = this.expandedSections();
    const newExpanded = new Set(expanded);

    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.clear();
      newExpanded.add(sectionId);
    }

    this.expandedSections.set(newExpanded);
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.allOpen() || this.expandedSections().has(sectionId);
  }

  /** Close all expanded sections when navigating to a menu item */
  onMenuItemClick(): void {
    this.allOpen.set(false);
    this.expandedSections.set(new Set());
  }

  isDashboardActive = computed(() =>
    this.currentUrl().includes('/app/dashboard')
  );

  /** Check if any item in this section is currently active */
  hasSectionActiveChild(section: MenuSection): boolean {
    const url = this.currentUrl(); // Use reactive signal
    return section.items.some(item => {
      if (item.exact) {
        return url === item.route;
      }
      return url.startsWith(item.route);
    });
  }

  async logout(): Promise<void> {
    // Was previously just resetting the theme and navigating — the actual
    // session (tokens, /me profile) was never cleared, so a "logged out" tab
    // would still pass authGuard on the next nav.
    await this.userAuth.logout();
    this.orgTheme.reset();
    this.router.navigate(['/']);
  }

  /** Organisation name — triggers joint-venture mode when set */
  @Input() orgName = '';
  /** Organisation logo URL — resets the broken-image flag whenever the URL changes. */
  logoFailed = false;
  private _orgLogoUrl = '';
  get orgLogoUrl(): string { return this._orgLogoUrl; }
  @Input() set orgLogoUrl(url: string) { this._orgLogoUrl = url; this.logoFailed = false; }
  /** Brand accent hex color — changes sidebar accent in JV mode e.g. '#10b981' */
  @Input() orgAccentColor = '';

  get isJv(): boolean {
    return !!(this.orgName || this.orgLogoUrl);
  }

  /** Resolved accent — always uses the org/app accent, falling back to default teal */
  get accentColor(): string {
    return this.orgAccentColor || '#0d9488';
  }
}
