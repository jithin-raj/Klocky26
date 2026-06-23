import { Component, ChangeDetectionStrategy, computed, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import { EmployeeResponse } from '../../../employees/models/employee-api.model';
import { Department } from '../../../../core/models/department.model';
import { TeamAttendanceItem } from '../../../../core/models/attendance.model';
import { HolidayDto } from '../../../../core/models/org-auth.model';

interface RecentActivity {
  name: string;
  initials: string;
  detail: string;
  time: string;
}

interface UpcomingHoliday {
  name: string;
  date: string;
  daysLeft: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {

  private readonly router      = inject(Router);
  private readonly appState    = inject(AppStateService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly deptSvc     = inject(DepartmentService);
  private readonly orgAuth     = inject(OrgAuthService);

  readonly attendanceSvc = inject(AttendanceStateService);

  ngOnDestroy() { /* services manage their own lifecycle */ }

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

  // ── Employees (GET /api/employees) ─────────────────────────────────────
  readonly employees       = signal<EmployeeResponse[]>([]);
  readonly employeesLoading = signal(true);
  readonly employeesError   = signal('');

  // ── Departments (GET /api/departments/getAllDepartments) ───────────────
  readonly departments       = signal<Department[]>([]);
  readonly departmentsLoading = signal(true);
  readonly departmentsError   = signal('');

  // ── Team attendance today (GET /api/attendance/team) ───────────────────
  readonly team        = signal<TeamAttendanceItem[]>([]);
  readonly teamLoading = signal(true);
  readonly teamError    = signal('');

  // ── Holidays (GET /api/tenant/settings — only if org-admin step-up already present) ─
  readonly holidays        = signal<HolidayDto[]>([]);
  readonly holidaysLoading = signal(false);
  readonly holidaysGated   = computed(() => !this.appState.isOrgAdminAuthenticated());

  ngOnInit(): void {
    this.employeeSvc.getAll().subscribe({
      next: (res) => { this.employees.set(res.data); this.employeesLoading.set(false); },
      error: () => { this.employeesError.set('Could not load employees.'); this.employeesLoading.set(false); },
    });

    this.deptSvc.getAll().subscribe({
      next: (res) => { this.departments.set(res.data); this.departmentsLoading.set(false); },
      error: () => { this.departmentsError.set('Could not load departments.'); this.departmentsLoading.set(false); },
    });

    this.attendanceSvc.getTeamStatus().subscribe({
      next: (res) => { this.team.set(res.data); this.teamLoading.set(false); },
      error: () => { this.teamError.set('Could not load today\'s attendance.'); this.teamLoading.set(false); },
    });

    if (this.appState.isOrgAdminAuthenticated()) {
      this.holidaysLoading.set(true);
      this.orgAuth.getTenantSettings().subscribe({
        next: (res) => { this.holidays.set(res.data.holidays ?? []); this.holidaysLoading.set(false); },
        error: () => { this.holidaysLoading.set(false); },
      });
    }
  }

  // ── Stat cards — every value here is derived from a real API response ──
  readonly stats = computed(() => [
    { label: 'Total Employees', value: String(this.employees().length), sub: `${this.activeCount()} active`, icon: 'people', color: '#6366f1', bg: '#eef2ff' },
    { label: 'Present Today',   value: String(this.presentCount()),     sub: `${this.presentPct()}% of team`, icon: 'check',  color: '#22c55e', bg: '#f0fdf4' },
    { label: 'Departments',     value: String(this.departments().length), sub: 'across the org',  icon: 'leaf',  color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Inactive',        value: String(this.inactiveCount()),    sub: 'deactivated accounts', icon: 'clock', color: '#ef4444', bg: '#fef2f2' },
  ]);

  activeCount   = computed(() => this.employees().filter(e => e.isActive).length);
  inactiveCount = computed(() => this.employees().filter(e => !e.isActive).length);

  // ── Today's attendance donut — present | half-day | absent-or-off ──────
  // The real AttendanceStatus enum has no "late" concept, only
  // present|half|absent|leave|holiday|off — half-day is the closest
  // server-backed equivalent to the old mock "late" segment.
  presentCount  = computed(() => this.team().filter(t => t.today?.status === 'present').length);
  halfDayCount  = computed(() => this.team().filter(t => t.today?.status === 'half').length);
  totalTeam     = computed(() => this.team().length);
  absentOrOffCount = computed(() => Math.max(0, this.totalTeam() - this.presentCount() - this.halfDayCount()));

  presentPct = computed(() => this.totalTeam() ? Math.round((this.presentCount() / this.totalTeam()) * 100) : 0);
  halfPct    = computed(() => this.totalTeam() ? Math.round((this.halfDayCount() / this.totalTeam()) * 100) : 0);
  absentPct  = computed(() => this.totalTeam() ? Math.round((this.absentOrOffCount() / this.totalTeam()) * 100) : 0);

  readonly circ = 263.9;
  presentDash  = computed(() => this.totalTeam() ? (this.presentCount() / this.totalTeam()) * this.circ : 0);
  halfDash     = computed(() => this.totalTeam() ? (this.halfDayCount() / this.totalTeam()) * this.circ : 0);
  absentDash   = computed(() => this.totalTeam() ? (this.absentOrOffCount() / this.totalTeam()) * this.circ : 0);
  halfOffset   = computed(() => -this.presentDash());
  absentOffset = computed(() => -(this.presentDash() + this.halfDash()));

  // ── Headcount by department — real member counts straight from the API ─
  maxDeptCount = computed(() => Math.max(1, ...this.departments().map(d => d.memberCount)));
  deptBarWidth(d: Department): number {
    return Math.round((d.memberCount / this.maxDeptCount()) * 100);
  }

  // ── Recent activity — most recently joined employees (closest honest
  // substitute for a "who joined/left today" feed; there's no activity-log API) ─
  recentActivity = computed<RecentActivity[]>(() => {
    return [...this.employees()]
      .filter(e => !!e.dateOfJoining)
      .sort((a, b) => (b.dateOfJoining! > a.dateOfJoining! ? 1 : -1))
      .slice(0, 6)
      .map(e => ({
        name: e.fullName,
        initials: e.fullName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        detail: `Joined · ${e.departmentName ?? 'Unassigned'}`,
        time: new Date(e.dateOfJoining!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      }));
  });

  // ── Upcoming holidays — next occurrence of each month/day, soonest first ─
  upcomingHolidays = computed<UpcomingHoliday[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.holidays()
      .map(h => {
        let next = new Date(now.getFullYear(), h.month - 1, h.day);
        if (next < startOfToday) next = new Date(now.getFullYear() + 1, h.month - 1, h.day);
        const daysLeft = Math.round((next.getTime() - startOfToday.getTime()) / 86_400_000);
        return {
          name: h.name,
          date: next.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }),
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  });

  quickActions = [
    { label: 'Add Employee',   icon: '➕', accent: '#6366f1', action: 'add-employee' },
    { label: 'Departments & Roles', icon: '🏷️', accent: '#22c55e', action: 'org-structure' },
    { label: 'Geo-fencing',    icon: '📍', accent: '#f59e0b', action: 'geofence' },
    { label: 'Org Settings',   icon: '⚙️', accent: '#ec4899', action: 'settings' },
  ];

  onQuickAction(action: string): void {
    const org = this.appState.orgUrlName();
    const routes: Record<string, string> = {
      'add-employee':  `/${org}/app/employees/add`,
      'org-structure': `/${org}/app/employees/org-structure`,
      'geofence':       `/${org}/app/attendance/geofence`,
      'settings':       `/${org}/app/settings/org-profile`,
    };
    const route = routes[action];
    if (route) this.router.navigate([route]);
  }

  goLanding() { this.router.navigate(['/']); }
}
