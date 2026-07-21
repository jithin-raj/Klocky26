import {
  Component, ChangeDetectionStrategy, signal, computed, inject, effect, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UiIconComponent, UiSelectComponent, UiDatePickerComponent } from '../../../../shared/components';
import { UiTimePickerComponent } from '../../../../shared/components/ui-timepicker/ui-timepicker.component';
import { TaskService } from '../../../../core/services/task.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { LeaveService } from '../../../../core/services/leave.service';
import { AttendanceRequestService } from '../../../../core/services/attendance-request.service';
import { OfficeService } from '../../../../core/services/office.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { PendingTaskItem, PendingTaskType } from '../../../../core/models/task.model';
import { LeaveTypeOption, HalfDaySession } from '../../../../core/models/leave.model';
import { AttendanceRequestType, ATTENDANCE_REQUEST_TYPE_LABELS } from '../../../../core/models/attendance-request.model';
import { TaskHistoryComponent } from '../history/task-history.component';
import { WorkTasksComponent } from '../work-tasks/work-tasks.component';
import { AllTasksComponent } from '../all-tasks/all-tasks.component';
import { OrgDateOnlyPipe, OrgDateTimePipe } from '../../../../shared/pipes/localization.pipes';

export type TaskListTab = 'all' | 'pending' | 'history' | 'mine';
type NewMenuOption = 'custom' | 'leave' | 'regularisation' | 'comp_off';

@Component({
  selector: 'app-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, UiIconComponent, UiSelectComponent, UiDatePickerComponent, UiTimePickerComponent,
    TaskHistoryComponent, WorkTasksComponent, AllTasksComponent, OrgDateOnlyPipe, OrgDateTimePipe,
  ],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {

  @ViewChild(WorkTasksComponent) private workTasksRef?: WorkTasksComponent;

  private readonly taskSvc     = inject(TaskService);
  private readonly realtime    = inject(RealtimeService);
  private readonly permissions = inject(PermissionService);
  private readonly leaveSvc    = inject(LeaveService);
  private readonly attendanceSvc = inject(AttendanceRequestService);
  private readonly officeSvc   = inject(OfficeService);
  private readonly toast       = inject(ToastService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);

  readonly todayIso = new Date().toISOString().slice(0, 10);

  // ── Tabs ───────────────────────────────────────────────────────────────
  activeTab = signal<TaskListTab>('all');
  readonly tabs: { id: TaskListTab; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'pending',  label: 'Pending' },
    { id: 'history',  label: 'History' },
    { id: 'mine',     label: 'My Tasks' },
  ];

  /** Captured from ?returnUrl= — where to send the user after a successful quick-create. */
  private returnUrl: string | null = null;

  // ── Approvals inbox ───────────────────────────────────────────────────
  // level 0 = no access (list hidden), level 1 = view only, level 2/3 = can approve/reject/add.
  readonly canView = computed(() => this.permissions.can('tasks', 1));
  readonly canAct  = computed(() => this.permissions.can('tasks', 2));

  pendingTasks   = signal<PendingTaskItem[]>([]);
  loadingPending = signal(false);
  pendingError   = signal<string | null>(null);
  inboxBusyId    = signal<string | null>(null);

  rejectTarget   = signal<PendingTaskItem | null>(null);
  rejectMsg      = signal('');

  viewTarget     = signal<PendingTaskItem | null>(null);

  readonly pendingCount = computed(() => this.pendingTasks().length);

  constructor() {
    // Permissions resolve async (GET /permissions/me fired from the shell) — react
    // once they land instead of checking canView() only at the ngOnInit instant.
    effect(() => {
      if (this.permissions.loaded() && this.canView()) this.loadPending();
    });

    // Live refresh — if the Pending tab is open, a new request/decision refreshes it.
    this.realtime.on('notification.created').subscribe(() => {
      if (this.activeTab() === 'pending' && this.canView()) this.loadPending();
    });
  }

  ngOnInit(): void {
    this.loadLeaveOptions();
    this.loadOffices();
    this.loadSelectableRange();

    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) this.returnUrl = params['returnUrl'];

      const tab = params['tab'] as TaskListTab;
      if (tab && this.tabs.some(t => t.id === tab)) this.activeTab.set(tab);

      const newType = params['new'] as NewMenuOption | undefined;
      if (newType) this.selectNewOption(newType, params['date'] || '', params['leaveTypeId'] || '');
    });
  }

  loadPending() {
    this.loadingPending.set(true);
    this.pendingError.set(null);
    this.taskSvc.getPending().subscribe({
      next: items => { this.pendingTasks.set(items); this.loadingPending.set(false); },
      error: err  => {
        this.pendingTasks.set([]);
        this.loadingPending.set(false);
        this.pendingError.set(err?.error?.error ?? err?.message ?? `Request failed (${err?.status ?? 'unknown'})`);
      },
    });
  }

  approveTask(item: PendingTaskItem) {
    if (this.inboxBusyId() || !this.canAct()) return;
    this.inboxBusyId.set(item.id);
    this.taskSvc.doAction({ taskType: item.taskType, taskId: item.id, action: 'approve' }).subscribe({
      next: () => {
        this.inboxBusyId.set(null);
        this.pendingTasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Approved', `${item.title} has been approved.`);
        this.taskSvc.refreshCounts();
      },
      error: err => {
        this.inboxBusyId.set(null);
        this.toast.error('Could not approve', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  openView(item: PendingTaskItem) {
    this.viewTarget.set(item);
  }

  closeView() {
    this.viewTarget.set(null);
  }

  /** Row-level closing date — use `to`, fall back to `from` for single-day requests. */
  closingDate(item: PendingTaskItem): string | null {
    return item.to ?? item.from;
  }

  openRejectTask(item: PendingTaskItem) {
    if (!this.canAct()) return;
    this.rejectTarget.set(item);
    this.rejectMsg.set('');
  }

  cancelReject() {
    this.rejectTarget.set(null);
  }

  confirmReject() {
    const item = this.rejectTarget();
    if (!item || !this.rejectMsg().trim() || !this.canAct()) return;
    this.inboxBusyId.set(item.id);
    this.taskSvc.doAction({ taskType: item.taskType, taskId: item.id, action: 'reject', message: this.rejectMsg().trim() }).subscribe({
      next: () => {
        this.inboxBusyId.set(null);
        this.rejectTarget.set(null);
        this.pendingTasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Rejected', `${item.title} has been rejected.`);
        this.taskSvc.refreshCounts();
      },
      error: err => {
        this.inboxBusyId.set(null);
        this.toast.error('Could not reject', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  taskTypeLabel(t: PendingTaskType): string {
    return { leave_approval: 'Leave', regularization_approval: 'Attendance', comp_off_approval: 'Comp-Off' }[t];
  }

  taskTypeBadgeClass(t: PendingTaskType): string {
    return {
      leave_approval: 'tk-badge--leave',
      regularization_approval: 'tk-badge--attendance',
      comp_off_approval: 'tk-badge--compoff',
    }[t];
  }

  // ── "New" split-button ─────────────────────────────────────────────────
  newMenuOpen = signal(false);
  toggleNewMenu(): void { this.newMenuOpen.update(v => !v); }
  closeNewMenu(): void { this.newMenuOpen.set(false); }

  selectNewOption(option: NewMenuOption, date = '', leaveTypeId = ''): void {
    this.closeNewMenu();
    if (option === 'custom') {
      this.activeTab.set('mine');
      setTimeout(() => this.workTasksRef?.openCreate());
      return;
    }
    if (option === 'leave') { this.openLeaveModal(false, date, leaveTypeId); return; }
    if (option === 'comp_off') { this.openLeaveModal(true, date, leaveTypeId); return; }
    if (option === 'regularisation') { this.openRegularisationModal(date); return; }
  }

  // ── Quick-create: Leave / Comp-off ──────────────────────────────────────
  leaveModalOpen   = signal(false);
  leaveIsCompOff   = signal(false);
  leaveTypes       = signal<LeaveTypeOption[]>([]);
  leaveTypeId      = signal('');
  leaveFromDate    = signal(this.todayIso);
  leaveToDate      = signal(this.todayIso);
  leaveReason      = signal('');
  leaveHalfDay     = signal(false);
  leaveHalfSession = signal<HalfDaySession>('first_half');
  leaveWorkedDate  = signal('');
  leaveSubmitting  = signal(false);

  readonly sessionOptions = [
    { label: 'First half',  value: 'first_half'  },
    { label: 'Second half', value: 'second_half' },
  ];

  readonly leaveTypeOptions = computed(() => {
    const compOff = this.leaveIsCompOff();
    return this.leaveTypes()
      .filter(t => t.isCompOff === compOff)
      .map(t => ({ label: t.name, value: t.leaveTypeId }));
  });

  private loadLeaveOptions(): void {
    this.leaveSvc.types().subscribe({ next: t => this.leaveTypes.set(t), error: () => {} });
  }

  openLeaveModal(isCompOff: boolean, date = '', leaveTypeId = ''): void {
    this.leaveIsCompOff.set(isCompOff);
    this.leaveTypeId.set(leaveTypeId);
    this.leaveFromDate.set(date || this.todayIso);
    this.leaveToDate.set(date || this.todayIso);
    this.leaveReason.set('');
    this.leaveHalfDay.set(false);
    this.leaveHalfSession.set('first_half');
    this.leaveWorkedDate.set('');
    this.leaveModalOpen.set(true);
  }

  closeLeaveModal(): void { this.leaveModalOpen.set(false); }

  onLeaveFromChange(v: string): void {
    this.leaveFromDate.set(v);
    if (this.leaveHalfDay() || this.leaveToDate() < v) this.leaveToDate.set(v);
  }

  readonly canSubmitLeave = computed(() => {
    if (this.leaveSubmitting() || !this.leaveTypeId() || !this.leaveFromDate() || !this.leaveToDate()) return false;
    if (this.leaveToDate() < this.leaveFromDate()) return false;
    if (this.leaveHalfDay() && this.leaveFromDate() !== this.leaveToDate()) return false;
    if (this.leaveIsCompOff() && !this.leaveWorkedDate()) return false;
    return true;
  });

  submitLeave(): void {
    if (!this.canSubmitLeave()) return;
    this.leaveSubmitting.set(true);
    this.leaveSvc.apply({
      leaveTypeId: this.leaveTypeId(),
      fromDate: this.leaveFromDate(),
      toDate: this.leaveToDate(),
      reason: this.leaveReason() || undefined,
      halfDay: this.leaveHalfDay(),
      halfDaySession: this.leaveHalfDay() ? this.leaveHalfSession() : undefined,
      workedDate: this.leaveIsCompOff() ? (this.leaveWorkedDate() || undefined) : undefined,
    }).subscribe({
      next: () => {
        this.leaveSubmitting.set(false);
        this.toast.success(this.leaveIsCompOff() ? 'Comp-off applied' : 'Leave applied', 'Your request has been submitted.');
        this.closeLeaveModal();
        this.taskSvc.refreshCounts();
        this.afterQuickCreateSuccess();
      },
      error: err => {
        this.leaveSubmitting.set(false);
        const status = err?.status;
        const msg = err?.error?.message ?? err?.error?.error;
        if (status === 409) this.toast.error('Request not allowed', msg ?? 'A request already exists for these dates, or the period is closed.');
        else if (status === 403) this.toast.error('Not permitted', msg ?? 'You do not have permission for this action.');
        else this.toast.error('Could not apply', msg ?? 'Please try again.');
      },
    });
  }

  // ── Quick-create: Regularisation ────────────────────────────────────────
  regModalOpen    = signal(false);
  regType         = signal<AttendanceRequestType>('missed_punch');
  regDate         = signal(this.todayIso);
  regClockIn      = signal('');
  regClockOut     = signal('');
  regOfficeId     = signal('');
  regReason       = signal('');
  regSubmitting   = signal(false);

  regMinDate      = signal('');
  regMaxDate      = signal(this.todayIso);
  regBlockedDates = signal<string[]>([]);

  officeOptions = signal<{ label: string; value: string }[]>([{ label: 'No specific office', value: '' }]);

  readonly regTypeOptions: { label: string; value: AttendanceRequestType }[] =
    (Object.keys(ATTENDANCE_REQUEST_TYPE_LABELS) as AttendanceRequestType[])
      .map(v => ({ label: ATTENDANCE_REQUEST_TYPE_LABELS[v], value: v }));

  private loadOffices(): void {
    this.officeSvc.getAll().subscribe({
      next: (res) => {
        const raw = res.data ?? [];
        const seen = new Set<string>();
        const unique = raw.filter((o: any) => !seen.has(o.id) && seen.add(o.id));
        this.officeOptions.set([{ label: 'No specific office', value: '' }, ...unique.map((o: any) => ({ label: o.name, value: o.id }))]);
      },
      error: () => {},
    });
  }

  private loadSelectableRange(): void {
    this.attendanceSvc.getSelectableRange().subscribe({
      next: (res) => {
        this.regMinDate.set(res.minDate ?? '');
        this.regMaxDate.set(res.maxDate || this.todayIso);
        this.regBlockedDates.set(res.blockedDates ?? []);
      },
      error: () => {},
    });
  }

  openRegularisationModal(date = ''): void {
    this.regType.set('missed_punch');
    this.regDate.set(date || this.todayIso);
    this.regClockIn.set('09:00');
    this.regClockOut.set('18:30');
    this.regOfficeId.set('');
    this.regReason.set('');
    this.regModalOpen.set(true);
  }

  closeRegModal(): void { this.regModalOpen.set(false); }

  readonly canSubmitReg = computed(() => {
    if (this.regSubmitting() || !this.regDate()) return false;
    if (this.regType() === 'wfh') return true;
    return !!this.regClockIn();
  });

  submitRegularisation(): void {
    if (!this.canSubmitReg()) return;
    this.regSubmitting.set(true);
    const type = this.regType();
    const clockInISO = this.toISODateTime(this.regDate(), this.regClockIn());
    const clockOutISO = this.toISODateTime(this.regDate(), this.regClockOut());
    this.attendanceSvc.create({
      date: this.regDate(),
      type,
      clockIn: type !== 'wfh' ? clockInISO : undefined,
      clockOut: type !== 'wfh' ? clockOutISO : undefined,
      officeId: this.regOfficeId() || undefined,
      reason: this.regReason() || undefined,
    }).subscribe({
      next: () => {
        this.regSubmitting.set(false);
        this.toast.success('Request submitted', 'Your attendance request is awaiting approval.');
        this.closeRegModal();
        this.taskSvc.refreshCounts();
        this.loadSelectableRange();
        this.afterQuickCreateSuccess();
      },
      error: err => {
        this.regSubmitting.set(false);
        const status = err?.status;
        const msg = err?.error?.message ?? err?.error?.error;
        if (status === 409) {
          this.toast.error('Request not allowed', msg ?? 'A request already exists for this day, or the period is closed.');
          this.loadSelectableRange();
        } else if (status === 403) {
          this.toast.error('Not permitted', msg ?? 'You do not have permission for this action.');
        } else {
          this.toast.error('Could not submit', msg ?? 'Please try again.');
        }
      },
    });
  }

  /** Combines a local date (YYYY-MM-DD) and time (HH:mm) into a UTC ISO-8601 datetime string. */
  private toISODateTime(date: string, time: string): string | undefined {
    if (!time || !date) return undefined;
    const [h, m] = time.split(':').map(Number);
    const dt = new Date(`${date}T00:00:00`);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  }

  /** After any quick-create succeeds: go back to wherever the caller came from (e.g. the calendar), if given. */
  private afterQuickCreateSuccess(): void {
    if (this.returnUrl) this.router.navigateByUrl(this.returnUrl);
  }
}
