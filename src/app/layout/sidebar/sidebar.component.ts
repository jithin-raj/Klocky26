import { Component, Input, inject, signal, effect, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import {
  IconKlockyLogoComponent,
} from '../../shared/icons';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

interface MenuSection {
  id: string;
  label: string;
  icon: string;
  expanded: boolean;
  items: MenuItem[];
}

@Component({
  selector: 'klocky-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IconKlockyLogoComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() isOpen = false;

  private router    = inject(Router);
  private orgTheme  = inject(OrgThemeService);
  private appState  = inject(AppStateService);
  
  // Track current URL reactively
  currentUrl = signal<string>(this.router.url);
  
  // Org-scoped route prefix
  orgPrefix = computed(() => `/${this.appState.orgSlug() || 'default'}`);
  
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

  // Menu structure with sections (routes without org prefix - added dynamically)
  private baseMenuSections: MenuSection[] = [
    {
      id: 'main',
      label: 'Main',
      icon: 'home',
      expanded: false,
      items: [
        { label: 'Dashboard', route: 'app/dashboard', icon: 'home', exact: true },
        { label: 'Admin Dashboard', route: 'app/dashboard/admin', icon: 'user' },
        { label: 'My Profile', route: 'app/profile', icon: 'profile' },
      ]
    },
    {
      id: 'people',
      label: 'People & Organization',
      icon: 'employees',
      expanded: false,
      items: [
        { label: 'Employees', route: 'app/employees', icon: 'employees', exact: true },
        { label: 'Org Tree', route: 'app/employees/tree', icon: 'tree' },
        { label: 'Roles & Permissions', route: 'app/roles', icon: 'roles' },
      ]
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: 'clock',
      expanded: false,
      items: [
        { label: 'Attendance', route: 'app/attendance', icon: 'clock', exact: true },
        { label: 'Shifts & Roster', route: 'app/shifts', icon: 'shifts' },
        { label: 'Geo-fencing', route: 'app/attendance/geofence', icon: 'geo' },
        { label: 'Face Scan', route: 'app/attendance/face-scan', icon: 'face' },
        { label: 'Face Roster', route: 'app/attendance/face-roster', icon: 'roster' },
      ]
    },
    {
      id: 'timeoff',
      label: 'Time Off & Work',
      icon: 'leaves',
      expanded: false,
      items: [
        { label: 'Leave Approvals', route: 'app/leaves', icon: 'leaves' },
        { label: 'Tasks', route: 'app/tasks', icon: 'tasks' },
        { label: 'Notifications', route: 'app/notifications', icon: 'notifications' },
      ]
    },
    {
      id: 'performance',
      label: 'Performance & HR',
      icon: 'performance',
      expanded: false,
      items: [
        { label: 'Performance', route: 'app/performance', icon: 'performance' },
        { label: 'HR Analytics', route: 'app/analytics', icon: 'analytics' },
        { label: 'Engagement', route: 'app/engagement', icon: 'engagement' },
        { label: 'Recruitment', route: 'app/recruitment', icon: 'recruitment' },
      ]
    },
  ];

  // Computed menu sections with org-scoped routes
  menuSections = computed(() => {
    const prefix = this.orgPrefix();
    return this.baseMenuSections.map(section => ({
      ...section,
      items: section.items.map(item => ({
        ...item,
        route: `${prefix}/${item.route}`
      }))
    }));
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

  logout(): void {
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
