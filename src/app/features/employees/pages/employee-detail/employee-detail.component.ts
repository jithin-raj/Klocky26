import {
  Component, ChangeDetectionStrategy, signal, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ModalService } from '../../../../shared/components/ui-modal/modal.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  TempPasswordDialogComponent, UiConfirmDangerComponent,
} from '../../../../shared/components';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';
import { EmployeeResponse } from '../../models/employee-api.model';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { LocalizationService } from '../../../../core/services/localization.service';
import { MarkPresentDialogService } from '../../../../shared/components/mark-present-dialog/mark-present-dialog.service';
import { CalendarDayStatus } from '../../../../core/models/attendance.model';

interface AttendanceRow {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  status: CalendarDayStatus;
}

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9',
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, TempPasswordDialogComponent, UiConfirmDangerComponent, OrgDateOnlyPipe,
  ],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss',
})
export class EmployeeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private appState = inject(AppStateService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private permissions = inject(PermissionService);
  private attendanceSvc = inject(AttendanceStateService);
  private loc = inject(LocalizationService);
  private markPresentDialog = inject(MarkPresentDialogService);

  employee = signal<EmployeeResponse | null>(null);
  loading  = signal(true);
  notFound = signal(false);

  readonly canViewSalary = computed(() => this.permissions.can('payroll', 1));
  readonly canEditSalary = computed(() => this.permissions.can('payroll', 2));

  openSalary(): void {
    const id = this.employee()?.employeeId;
    if (!id) return;
    this.orgNav.navigate(['app', 'compensation', 'employee', id]);
  }

  empTypeLabel(t?: string | null): string {
    if (!t) return '—';
    return ({ full_time: 'Full-time', part_time: 'Part-time', permanent: 'Permanent', contract: 'Contract', intern: 'Intern' } as Record<string, string>)[t]
      ?? (t.charAt(0).toUpperCase() + t.slice(1));
  }

  // Account actions (moved here from the grid). Gated on the reliable /me role
  // flags (admin/HR/manager) rather than the matrix, which may not be wired yet.
  readonly canManage = computed(() => {
    const u = this.appState.user();
    return !!(u?.isAdmin || u?.isHr || u?.isManager);
  });
  /** Permanent delete is admin-only (full access). */
  readonly canHardDelete = computed(() => !!this.appState.user()?.isAdmin);
  tempPassword = signal<string | null>(null);
  hardDeleteOpen = signal(false);
  hardDeleting = signal(false);

  attendanceRows = signal<AttendanceRow[]>([]);
  attendanceLoading = signal(false);
  private attendanceLoadedFor: string | null = null;

  /** attendance permission level >= 2, or admin. */
  readonly canMarkPresent = computed(() => this.permissions.can('attendance', 2));
  markPresentBusy = signal(false);
  selectedDates = signal<Set<string>>(new Set());
  readonly eligibleDates = computed(() => this.attendanceRows().filter(r => this.canMarkPresentRow(r)).map(r => r.date));
  readonly allEligibleSelected = computed(() => {
    const eligible = this.eligibleDates();
    return eligible.length > 0 && eligible.every(d => this.selectedDates().has(d));
  });

  private loadAttendance(): void {
    const id = this.employee()?.employeeId;
    if (!id || this.attendanceLoadedFor === id) return;
    this.attendanceLoadedFor = id;
    this.selectedDates.set(new Set());
    this.attendanceLoading.set(true);
    const now = new Date();
    this.attendanceSvc.getCalendar(now.getFullYear(), now.getMonth() + 1, id).subscribe({
      next: (res) => {
        const days = res.data?.days ?? [];
        this.attendanceRows.set(
          days
            .filter(d => !d.isUpcoming && !d.isWeekend && d.status !== 'holiday')
            .map(d => ({
              date: d.date,
              checkIn: d.clockInTime ? this.loc.formatTime(d.clockInTime) : '–',
              checkOut: d.clockOutTime ? this.loc.formatTime(d.clockOutTime) : '–',
              hours: d.hoursWorked ?? d.presentHours ?? 0,
              status: d.status,
            }))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10),
        );
        this.attendanceLoading.set(false);
      },
      error: () => {
        this.attendanceLoading.set(false);
        this.attendanceLoadedFor = null;
      },
    });
  }

  /** Only absent/half/no-record days — never leave/comp-off/holiday. */
  canMarkPresentRow(row: AttendanceRow): boolean {
    return this.canMarkPresent() && (row.status === 'absent' || row.status === 'half_day');
  }

  isDateSelected(date: string): boolean {
    return this.selectedDates().has(date);
  }

  toggleDate(date: string): void {
    this.selectedDates.update(set => {
      const next = new Set(set);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  toggleSelectAllEligible(): void {
    const eligible = this.eligibleDates();
    this.selectedDates.set(this.allEligibleSelected() ? new Set() : new Set(eligible));
  }

  async markPresentSelected(): Promise<void> {
    const emp = this.employee();
    const dates = Array.from(this.selectedDates());
    if (!emp || !dates.length || this.markPresentBusy()) return;
    this.markPresentBusy.set(true);
    try {
      const results = await this.markPresentDialog.open({
        items: dates.map(date => ({ userId: emp.employeeId, userName: emp.fullName, date })),
      });
      if (results?.some(r => r.success)) {
        this.attendanceLoadedFor = null;
        this.loadAttendance();
      }
      // Drop only the dates that actually succeeded — keep failures selected so they're easy to find again.
      const succeededDates = new Set((results ?? []).filter(r => r.success).map(r => r.date));
      this.selectedDates.update(set => new Set([...set].filter(d => !succeededDates.has(d))));
    } finally {
      this.markPresentBusy.set(false);
    }
  }

  readonly mockLeaves = [
    { type: 'Casual Leave', from: '2026-03-15', to: '2026-03-16', days: 2, status: 'approved' },
    { type: 'Sick Leave',   from: '2026-02-10', to: '2026-02-11', days: 2, status: 'approved' },
    { type: 'Earned Leave', from: '2026-05-05', to: '2026-05-09', days: 5, status: 'pending'  },
  ];

  readonly mockGoals = [
    { title: 'Complete Q1 OKRs',        progress: 85, due: '2026-03-31', status: 'on_track'   },
    { title: 'Finish certification',     progress: 45, due: '2026-06-30', status: 'at_risk'    },
    { title: 'Team knowledge sessions',  progress: 100,due: '2026-04-30', status: 'completed'  },
  ];

  activeTab = signal<'overview' | 'attendance' | 'leaves' | 'performance'>('overview');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.employeeService.getById(id).subscribe({
      next: (res) => {
        this.employee.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  goBack()  { this.orgNav.navigate(['app', 'employees']); }
  editEmp() { this.orgNav.navigate(['app', 'employees', this.employee()?.employeeId ?? '', 'edit']); }
  setTab(t: 'overview' | 'attendance' | 'leaves' | 'performance') {
    this.activeTab.set(t);
    if (t === 'attendance') this.loadAttendance();
  }

  activateEmployee() {
    const id = this.employee()?.employeeId;
    if (!id) return;
    this.employeeService.activate(id).subscribe({ next: (res) => this.employee.set(res.data) });
  }

  deactivateEmployee() {
    const id = this.employee()?.employeeId;
    if (!id) return;
    this.employeeService.deactivate(id).subscribe({ next: (res) => this.employee.set(res.data) });
  }

  // ── Generate password (spec §5) ────────────────────────────────────────
  generatePassword() {
    const id = this.employee()?.employeeId;
    if (!id) return;
    this.employeeService.generatePassword(id).subscribe({
      next: (res) => this.tempPassword.set(res.data?.temporaryPassword ?? ''),
      error: (err) => this.toast.error('Could not generate password', extractApiErrorMessage(err)),
    });
  }

  // ── Soft / hard delete (spec §4) ────────────────────────────────────────
  async softDelete() {
    const emp = this.employee();
    if (!emp) return;
    const ok = await this.modal.confirm({
      title: 'Delete employee',
      message: `Delete ${emp.fullName}? They'll be removed from the active roster but can be restored.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    this.employeeService.delete(emp.employeeId).subscribe({
      next: () => {
        this.toast.success('Employee deleted', `${emp.fullName} was removed.`);
        this.goBack();
      },
      error: (err) => this.toast.error('Could not delete employee', extractApiErrorMessage(err)),
    });
  }

  doHardDelete() {
    const emp = this.employee();
    if (!emp || this.hardDeleting()) return;
    this.hardDeleting.set(true);
    this.employeeService.hardDelete(emp.employeeId).subscribe({
      next: () => {
        this.hardDeleting.set(false);
        this.hardDeleteOpen.set(false);
        this.toast.success('Employee permanently deleted', `${emp.fullName} and their data were removed.`);
        this.goBack();
      },
      error: (err) => {
        this.hardDeleting.set(false);
        this.hardDeleteOpen.set(false);
        this.toast.error('Could not delete employee', extractApiErrorMessage(err));
      },
    });
  }

  initials(emp: EmployeeResponse) { return initialsOf(emp.fullName); }
  avatarColor(emp: EmployeeResponse) { return colorFor(emp.employeeId); }

  attendanceRate = 92;
  leaveBalance   = 12;

  statusClass(s: string) { return s; }
}
