import { Component, ChangeDetectionStrategy, computed, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../../../core/services/app-state.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import { EmployeeResponse } from '../../../employees/models/employee-api.model';
import { Department } from '../../../../core/models/department.model';
import { HolidayDto } from '../../../../core/models/org-auth.model';
import { UiIconComponent, UiIconName } from '../../../../shared/components';

interface RecentActivity { name: string; initials: string; detail: string; time: string; color: string; }
interface UpcomingHoliday { name: string; date: string; daysLeft: number; }
interface QuickAction { label: string; sub: string; icon: UiIconName; accent: string; action: string; }
interface CompositionRow { label: string; count: number; pct: number; color: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, UiIconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {

  private readonly router      = inject(Router);
  private readonly appState    = inject(AppStateService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly deptSvc     = inject(DepartmentService);
  private readonly orgRoleSvc  = inject(OrgRoleService);
  private readonly orgAuth     = inject(OrgAuthService);

  today = new Date();

  greeting = computed(() => {
    const h = this.today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  get org() {
    const u = this.appState.user();
    const name = u?.companyName ?? '';
    return {
      name,
      initials: name ? name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'ORG',
      admin: u?.fullName ?? '',
      role: u?.role ?? '',
    };
  }

  // ── Data ───────────────────────────────────────────────────────────────
  readonly employees        = signal<EmployeeResponse[]>([]);
  readonly employeesLoading = signal(true);
  readonly departments        = signal<Department[]>([]);
  readonly departmentsLoading = signal(true);
  readonly departmentsError   = signal('');
  readonly orgRolesCount = signal(0);

  readonly holidays        = signal<HolidayDto[]>([]);
  readonly holidaysLoading = signal(false);
  readonly holidaysGated   = computed(() => !this.appState.isOrgAdminAuthenticated());

  ngOnInit(): void {
    this.employeeSvc.getAll().subscribe({
      next: (res) => { this.employees.set(res.data ?? []); this.employeesLoading.set(false); },
      error: () => { this.employeesLoading.set(false); },
    });
    this.deptSvc.getAll().subscribe({
      next: (res) => { this.departments.set(res.data ?? []); this.departmentsLoading.set(false); },
      error: () => { this.departmentsError.set('Could not load departments.'); this.departmentsLoading.set(false); },
    });
    this.orgRoleSvc.getAll().subscribe({
      next: (res) => this.orgRolesCount.set((res.data ?? []).length),
      error: () => {},
    });
    if (this.appState.isOrgAdminAuthenticated()) {
      this.holidaysLoading.set(true);
      this.orgAuth.getTenantSettings().subscribe({
        next: (res) => { this.holidays.set(res.data.holidays ?? []); this.holidaysLoading.set(false); },
        error: () => { this.holidaysLoading.set(false); },
      });
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────
  activeCount   = computed(() => this.employees().filter(e => e.isActive).length);
  inactiveCount = computed(() => this.employees().filter(e => !e.isActive).length);
  guestCount    = computed(() => this.employees().filter(e => e.isGuest).length);
  newThisMonth  = computed(() => {
    const now = new Date();
    return this.employees().filter(e => {
      if (!e.dateOfJoining) return false;
      const d = new Date(e.dateOfJoining);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  });

  // ── Stat cards — meaningful org-admin figures (no attendance) ──────────
  readonly stats = computed<{ label: string; value: string; sub: string; icon: UiIconName; color: string; bg: string }[]>(() => [
    { label: 'Total Employees', value: String(this.employees().length), sub: `${this.activeCount()} active`,       icon: 'users',      color: '#6366f1', bg: '#eef2ff' },
    { label: 'Departments',     value: String(this.departments().length), sub: 'across the org',                   icon: 'building',   color: '#0ea5e9', bg: '#eff6ff' },
    { label: 'Org Roles',       value: String(this.orgRolesCount()),    sub: 'hierarchy levels',                   icon: 'layers',     color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'New This Month',  value: String(this.newThisMonth()),     sub: this.guestCount() + ' guests total',  icon: 'sparkles',   color: '#22c55e', bg: '#f0fdf4' },
  ]);

  // ── Headcount by department ────────────────────────────────────────────
  maxDeptCount = computed(() => Math.max(1, ...this.departments().map(d => d.memberCount)));
  deptBarWidth(d: Department): number { return Math.round((d.memberCount / this.maxDeptCount()) * 100); }

  // ── Workforce composition — by employment type ────────────────────────
  private readonly EMP_TYPE_META: Record<string, { label: string; color: string }> = {
    full_time: { label: 'Full-time', color: '#6366f1' },
    permanent: { label: 'Permanent', color: '#0ea5e9' },
    part_time: { label: 'Part-time', color: '#f59e0b' },
    contract:  { label: 'Contract',  color: '#8b5cf6' },
    intern:    { label: 'Intern',    color: '#22c55e' },
    unknown:   { label: 'Unspecified', color: '#94a3b8' },
  };
  composition = computed<CompositionRow[]>(() => {
    const total = this.employees().length || 1;
    const counts = new Map<string, number>();
    for (const e of this.employees()) {
      const k = e.employmentType && this.EMP_TYPE_META[e.employmentType] ? e.employmentType : 'unknown';
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([k, count]) => ({ label: this.EMP_TYPE_META[k].label, color: this.EMP_TYPE_META[k].color, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });

  // ── Recently joined ────────────────────────────────────────────────────
  private readonly AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#0ea5e9'];
  recentActivity = computed<RecentActivity[]>(() =>
    [...this.employees()]
      .filter(e => !!e.dateOfJoining)
      .sort((a, b) => (b.dateOfJoining! > a.dateOfJoining! ? 1 : -1))
      .slice(0, 6)
      .map((e, i) => ({
        name: e.fullName,
        initials: e.fullName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        detail: `${e.orgRoleName || e.role} · ${e.departmentName ?? 'Unassigned'}`,
        time: new Date(e.dateOfJoining!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        color: this.AVATAR_COLORS[i % this.AVATAR_COLORS.length],
      })),
  );

  // ── Upcoming holidays ──────────────────────────────────────────────────
  upcomingHolidays = computed<UpcomingHoliday[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.holidays()
      .map(h => {
        let next = new Date(now.getFullYear(), h.month - 1, h.day);
        if (next < startOfToday) next = new Date(now.getFullYear() + 1, h.month - 1, h.day);
        const daysLeft = Math.round((next.getTime() - startOfToday.getTime()) / 86_400_000);
        return { name: h.name, date: next.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }), daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  });

  // ── Quick actions — admin/HR workflows ─────────────────────────────────
  readonly quickActions: QuickAction[] = [
    { label: 'Add Employee',        sub: 'Onboard a new member',     icon: 'user-plus',        accent: '#6366f1', action: 'add-employee' },
    { label: 'Departments & Roles', sub: 'Org structure',            icon: 'sitemap',          accent: '#0ea5e9', action: 'org-structure' },
    { label: 'Roles & Permissions', sub: 'Access control',           icon: 'shield',           accent: '#8b5cf6', action: 'permissions' },
    { label: 'Leave Approvals',     sub: 'Review requests',          icon: 'clipboard-check',  accent: '#22c55e', action: 'leaves' },
    { label: 'Send Notification',   sub: 'Broadcast to the team',    icon: 'megaphone',        accent: '#f59e0b', action: 'notifications' },
    { label: 'Org Settings',        sub: 'Profile & policies',       icon: 'settings',         accent: '#ec4899', action: 'settings' },
  ];

  onQuickAction(action: string): void {
    const org = this.appState.orgUrlName();
    const routes: Record<string, string> = {
      'add-employee':  `/${org}/app/employees/add`,
      'org-structure': `/${org}/app/employees/org-structure`,
      'permissions':   `/${org}/app/roles`,
      'leaves':        `/${org}/app/leaves`,
      'notifications': `/${org}/app/notifications`,
      'settings':      `/${org}/app/settings/org-profile`,
    };
    const route = routes[action];
    if (route) this.router.navigate([route]);
  }
}
