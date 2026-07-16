import {
  Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';

import { AppStateService } from '../../core/services/app-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { AttendanceStateService } from '../../core/services/attendance-state.service';
import { UserAuthService } from '../../core/services/user-auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { UiIconComponent, UiIconName } from '../../shared/components';

export type BottomPanel = 'fab' | 'apps' | 'hub' | null;

interface AppTile {
  label: string;
  icon: UiIconName;
  route: string;
  color: string;
}

interface QuickAction {
  label: string;
  icon: UiIconName;
  route: string;
  color: string;
  desc: string;
}

@Component({
  selector: 'klocky-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, UiIconComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent implements OnInit, OnDestroy {
  private readonly router       = inject(Router);
  private readonly appState     = inject(AppStateService);
  readonly notifSvc             = inject(NotificationService);
  readonly attendanceSvc        = inject(AttendanceStateService);
  private readonly userAuth     = inject(UserAuthService);
  private readonly permissions  = inject(PermissionService);

  activePanel = signal<BottomPanel>(null);
  currentUrl  = signal(this.router.url);

  private sub?: Subscription;

  // ── User ────────────────────────────────────────────────────────────
  readonly user       = computed(() => this.appState.user());
  readonly orgPrefix  = computed(() => `/${this.appState.orgUrlName() || 'default'}`);
  readonly avatarUrl  = computed(() => this.user()?.avatarUrl ?? null);
  readonly fullName   = computed(() =>
    `${this.user()?.firstName ?? ''} ${this.user()?.lastName ?? ''}`.trim() || 'User');
  readonly initials   = computed(() => {
    const n = this.fullName().trim().split(/\s+/);
    return ((n[0]?.[0] ?? '') + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() || 'U';
  });
  readonly roleLabel  = computed(() => {
    switch (this.user()?.role) {
      case 'super_admin': return 'Super Admin';
      case 'admin':       return 'Admin';
      case 'hr':          return 'HR';
      case 'manager':     return 'Manager';
      default:            return 'Employee';
    }
  });
  readonly isAdmin  = computed(() => this.permissions.isAdmin());
  readonly isEmployee = computed(() => !this.permissions.isAdmin() && !this.permissions.isHr());

  // ── Notification badge ──────────────────────────────────────────────
  readonly unreadCount = computed(() => this.notifSvc.unreadCount());

  // ── Clock state (for FAB) ───────────────────────────────────────────
  readonly isClockedIn = computed(() => this.attendanceSvc.isClockedIn());
  readonly geoStatus   = computed(() => this.attendanceSvc.geoStatus());

  // ── Active tab ──────────────────────────────────────────────────────
  readonly activeTab = computed(() => {
    const url = this.currentUrl();
    if (url.includes('/app/dashboard')) return 'home';
    if (url.includes('/app/tasks'))     return 'tasks';
    return '';
  });

  // ── Apps grid ───────────────────────────────────────────────────────
  readonly appTiles = computed((): AppTile[] => {
    const p           = this.orgPrefix();
    const adminOrHr   = this.permissions.isAdmin() || this.permissions.isHr();
    const adminOnly   = this.permissions.isAdmin();
    return [
      // Employee-facing tiles — hidden for admins who have their own tools
      ...(!adminOnly ? [
        { label: 'Attendance',  icon: 'calendar' as UiIconName,  route: `${p}/app/attendance`,   color: '#6366f1' },
        { label: 'My Leave',    icon: 'clock' as UiIconName,     route: `${p}/app/leaves/my`,    color: '#f59e0b' },
      ] : []),
      { label: 'Time Mgmt',   icon: 'pie-chart',    route: `${p}/app/time-management`,                color: '#14b8a6' },
      { label: 'Org Tree',    icon: 'tree',         route: `${p}/app/employees/tree`,                 color: '#22c55e' },
      { label: 'Documents',   icon: 'layers',       route: `${p}/app/organisation/documents`,         color: '#8b5cf6' },
      { label: 'Recruitment', icon: 'briefcase',    route: `${p}/app/recruitment`,                    color: '#ec4899' },
      { label: 'Performance', icon: 'bar-chart',    route: `${p}/app/performance`,                    color: '#f97316' },
      { label: 'Refer',       icon: 'user-plus',    route: `${p}/app/recruitment/refer`,              color: '#0ea5e9' },
      ...(adminOrHr ? [
        { label: 'Employees',  icon: 'users' as UiIconName,         route: `${p}/app/employees`,                    color: '#64748b' },
        { label: 'Add Staff',  icon: 'user-check' as UiIconName,    route: `${p}/app/employees/add`,               color: '#0ea5e9' },
        { label: 'Approvals',  icon: 'check-circle' as UiIconName,  route: `${p}/app/leaves`,                      color: '#10b981' },
        { label: 'Leave Cats', icon: 'award' as UiIconName,         route: `${p}/app/settings/leave-categories`,   color: '#f59e0b' },
        { label: 'Billing',    icon: 'clipboard-check' as UiIconName, route: `${p}/app/billing`,                   color: '#eab308' },
      ] : []),
      ...(adminOnly ? [
        { label: 'Org Chart',  icon: 'sitemap' as UiIconName,  route: `${p}/app/employees/org-structure`,  color: '#3b82f6' },
        { label: 'Roles',      icon: 'shield' as UiIconName,   route: `${p}/app/employees/permissions`,    color: '#8b5cf6' },
        { label: 'Settings',   icon: 'settings' as UiIconName, route: `${p}/app/settings`,                 color: '#475569' },
      ] : []),
    ];
  });

  // ── Quick actions (FAB) ──────────────────────────────────────────────
  readonly quickActions = computed((): QuickAction[] => {
    const p       = this.orgPrefix();
    const isAdmin = this.permissions.isAdmin();
    return [
      ...(!isAdmin ? [
        { label: 'Apply Leave',        icon: 'calendar' as UiIconName, route: `${p}/app/leaves/my`,           color: '#f59e0b', desc: 'Submit a leave request' },
      ] : []),
      { label: 'Request Attendance',   icon: 'repeat',     route: `${p}/app/attendance/requests`, color: '#6366f1', desc: 'Regularize attendance' },
      ...(isAdmin ? [
        { label: 'Add Employee',       icon: 'user-check' as UiIconName, route: `${p}/app/employees/add`,  color: '#0ea5e9', desc: 'Add a new team member' },
        { label: 'Leave Approvals',    icon: 'check-circle' as UiIconName, route: `${p}/app/leaves`,       color: '#10b981', desc: 'Review pending leave requests' },
      ] : []),
    ];
  });

  // ── Hub notifications ────────────────────────────────────────────────
  readonly recentNotifs = computed(() => this.notifSvc.recent().slice(0, 5));

  ngOnInit() {
    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
        this.activePanel.set(null);
      });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  go(route: string) {
    this.activePanel.set(null);
    this.router.navigateByUrl(route);
  }

  goHome() {
    this.activePanel.set(null);
    this.router.navigate([this.orgPrefix(), 'app', 'dashboard']);
  }

  goTasks() {
    this.activePanel.set(null);
    this.router.navigate([this.orgPrefix(), 'app', 'tasks']);
  }

  togglePanel(p: BottomPanel) {
    this.activePanel.set(this.activePanel() === p ? null : p);
  }

  closePanel() { this.activePanel.set(null); }

  logout() {
    this.activePanel.set(null);
    this.userAuth.logout();
  }
}
