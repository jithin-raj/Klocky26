import { Component, Input, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import {
  IconKlockyLogoComponent,
} from '../../shared/icons';
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

@Component({
  selector: 'klocky-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IconKlockyLogoComponent,
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
  private baseMenuSections: MenuSection[] = [
    {
      id: 'people',
      label: 'People & Organization',
      icon: 'users',
      expanded: false,
      items: [
        { label: 'Employees', route: 'app/employees', icon: 'users', exact: true, roles: MANAGEMENT_ROLES, permKey: 'employees', permLevel: 1 },
        { label: 'Org Tree', route: 'app/employees/tree', icon: 'tree', roles: MANAGEMENT_ROLES },
        { label: 'Departments & Roles', route: 'app/employees/org-structure', icon: 'sitemap', roles: ADMIN_ONLY_ROLES },
        // Single canonical Roles & Permissions editor (the old duplicate "Permissions" link was removed).
        { label: 'Roles & Permissions', route: 'app/roles', icon: 'shield', roles: ADMIN_ONLY_ROLES, permKey: 'permissions', permLevel: 3 },
      ]
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: 'clock',
      expanded: false,
      items: [
        { label: 'Attendance', route: 'app/attendance', icon: 'clock', exact: true },
        { label: 'Shifts & Roster', route: 'app/shifts', icon: 'repeat', roles: MANAGEMENT_ROLES },
        { label: 'Geo-fencing', route: 'app/attendance/geofence', icon: 'map-pin', roles: ADMIN_ONLY_ROLES },
        { label: 'Face Scan', route: 'app/attendance/face-scan', icon: 'scan' },
        { label: 'Face Roster', route: 'app/attendance/face-roster', icon: 'users', roles: MANAGEMENT_ROLES },
      ]
    },
    {
      id: 'timeoff',
      label: 'Time Off & Work',
      icon: 'calendar',
      expanded: false,
      items: [
        { label: 'Leave Approvals', route: 'app/leaves', icon: 'calendar', roles: MANAGEMENT_ROLES },
        { label: 'Tasks', route: 'app/tasks', icon: 'clipboard-check' },
        { label: 'Notifications', route: 'app/notifications', icon: 'bell' },
      ]
    },
    {
      id: 'performance',
      label: 'Performance & HR',
      icon: 'bar-chart',
      expanded: false,
      items: [
        { label: 'Performance', route: 'app/performance', icon: 'bar-chart' },
        { label: 'HR Analytics', route: 'app/analytics', icon: 'pie-chart', roles: ADMIN_HR_ROLES },
        { label: 'Engagement', route: 'app/engagement', icon: 'sparkles', roles: MANAGEMENT_ROLES },
        { label: 'Recruitment', route: 'app/recruitment', icon: 'user-plus', roles: ADMIN_HR_ROLES },
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

  toggleSection(sectionId: string): void {
    const expanded = this.expandedSections();
    const newExpanded = new Set(expanded);

    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      // Close all other sections when opening a new one
      newExpanded.clear();
      newExpanded.add(sectionId);
    }

    this.expandedSections.set(newExpanded);
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSections().has(sectionId);
  }

  /** Close all expanded sections when navigating to a menu item */
  onMenuItemClick(): void {
    this.expandedSections.set(new Set());
  }

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
  /** Organisation logo URL — shown in JV brand area */
  @Input() orgLogoUrl = '';
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
