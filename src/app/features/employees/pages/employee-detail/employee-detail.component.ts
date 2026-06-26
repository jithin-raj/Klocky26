import {
  Component, ChangeDetectionStrategy, signal, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { ModalService } from '../../../../shared/components/ui-modal/modal.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  TempPasswordDialogComponent, UiConfirmDangerComponent,
} from '../../../../shared/components';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';
import { EmployeeResponse } from '../../models/employee-api.model';

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
    CommonModule, TempPasswordDialogComponent, UiConfirmDangerComponent,
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

  employee = signal<EmployeeResponse | null>(null);
  loading  = signal(true);
  notFound = signal(false);

  /** Basic salary is masked by default; reveal with the eye toggle (admin/HR data). */
  readonly salaryRevealed = signal(false);

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

  readonly mockAttendance = [
    { date: '2026-04-28', checkIn: '09:02', checkOut: '18:15', hours: 9.2, status: 'present' },
    { date: '2026-04-27', checkIn: '09:18', checkOut: '18:05', hours: 8.8, status: 'present' },
    { date: '2026-04-26', checkIn: '–', checkOut: '–', hours: 0, status: 'absent' },
    { date: '2026-04-25', checkIn: '08:55', checkOut: '17:50', hours: 8.9, status: 'present' },
    { date: '2026-04-24', checkIn: '09:10', checkOut: '13:00', hours: 3.8, status: 'half_day' },
  ];

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
  setTab(t: 'overview' | 'attendance' | 'leaves' | 'performance') { this.activeTab.set(t); }

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
