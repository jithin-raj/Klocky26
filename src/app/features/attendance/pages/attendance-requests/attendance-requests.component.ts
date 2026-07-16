import {
  Component, ChangeDetectionStrategy, signal, computed, inject, effect, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { UiSelectComponent, UiIconComponent } from '../../../../shared/components';
import { UiDatePickerComponent } from '../../../../shared/components/ui-datepicker/ui-datepicker.component';
import { UiTimePickerComponent } from '../../../../shared/components/ui-timepicker/ui-timepicker.component';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { AttendanceRequestService } from '../../../../core/services/attendance-request.service';
import { OfficeService } from '../../../../core/services/office.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { LeaveService } from '../../../../core/services/leave.service';
import { LocalizationService } from '../../../../core/services/localization.service';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';
import {
  AttendanceRequestResponse,
  AttendanceRequestType,
  ATTENDANCE_REQUEST_TYPE_LABELS,
} from '../../../../core/models/attendance-request.model';
import {
  HalfDaySession,
  LeaveBalance,
  LeaveRecord,
  LeaveTypeOption,
} from '../../../../core/models/leave.model';

export type HubTab    = 'request' | 'history' | 'approvals';
export type HubType   = 'leave' | 'missed_punch' | 'wfh' | 'on_duty' | 'correction' | 'encashment';

@Component({
  selector: 'app-attendance-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiIconComponent, UiDatePickerComponent, UiTimePickerComponent, OrgDateOnlyPipe],
  templateUrl: './attendance-requests.component.html',
  styleUrl: './attendance-requests.component.scss',
})
export class AttendanceRequestsComponent implements OnInit {

  private readonly svc      = inject(AttendanceRequestService);
  private readonly leaveSvc = inject(LeaveService);
  private readonly officeSvc= inject(OfficeService);
  private readonly appState = inject(AppStateService);
  private readonly toast    = inject(ToastService);
  private readonly route    = inject(ActivatedRoute);
  private readonly loc      = inject(LocalizationService);

  readonly todayIso = new Date().toISOString().slice(0, 10);

  // ── Hub type definitions ──────────────────────────────────────────────
  readonly hubTypes: { value: HubType; label: string; icon: string; desc: string }[] = [
    { value: 'leave',       label: 'Leave',          icon: 'calendar',     desc: 'Annual, sick or other leave' },
    { value: 'missed_punch', label: 'Missed Punch',  icon: 'clock',        desc: 'Fix a missed clock-in / out' },
    { value: 'wfh',         label: 'Work From Home', icon: 'home',         desc: 'Register a WFH day' },
    { value: 'on_duty',     label: 'On Duty',        icon: 'briefcase',    desc: 'Official off-site visit' },
    { value: 'correction',  label: 'Time Correction',icon: 'settings',     desc: 'Correct attendance times' },
    { value: 'encashment',  label: 'Leave Encashment',icon: 'award',       desc: 'Convert leave balance to pay' },
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────
  activeTab = signal<HubTab>('request');
  hubType   = signal<HubType>('leave');

  // ── Shared form fields ────────────────────────────────────────────────
  fromDate   = signal(this.todayIso);
  toDate     = signal(this.todayIso);
  reason     = signal('');
  submitting = signal(false);

  // ── Leave-specific ────────────────────────────────────────────────────
  leaveTypeId    = signal('');
  halfDay        = signal(false);
  halfDaySession = signal<HalfDaySession>('first_half');
  workedDate     = signal('');

  // ── Attendance-specific ───────────────────────────────────────────────
  clockIn  = signal('');
  clockOut = signal('');
  officeId = signal('');

  // ── Encashment-specific ───────────────────────────────────────────────
  encashLeaveTypeId = signal('');
  encashDays        = signal(1);

  readonly sessionOptions = [
    { label: 'First half',  value: 'first_half'  },
    { label: 'Second half', value: 'second_half' },
  ];

  // ── Data signals ──────────────────────────────────────────────────────
  leaveTypes    = signal<LeaveTypeOption[]>([]);
  leaveBalances = signal<LeaveBalance[]>([]);
  officeOptions = signal<{ label: string; value: string }[]>([
    { label: 'No specific office', value: '' },
  ]);

  // ── Computed ──────────────────────────────────────────────────────────
  readonly leaveTypeOptions = computed(() => {
    const balances = this.leaveBalances();
    return this.leaveTypes().map(t => {
      const bal = balances.find(b => b.leaveTypeId === t.leaveTypeId);
      const rem = bal?.remainingDays;
      const suffix = rem === undefined ? '' : rem === 0 ? ' — No balance' : ` — ${rem} day${rem === 1 ? '' : 's'}`;
      return { label: t.name + suffix, value: t.leaveTypeId };
    });
  });

  readonly encashTypeOptions = computed(() =>
    this.leaveTypes().filter(t => !t.isCompOff).map(t => ({ label: t.name, value: t.leaveTypeId })));

  readonly selectedLeaveType = computed(() =>
    this.leaveTypes().find(t => t.leaveTypeId === this.leaveTypeId()) ?? null);

  readonly isCompOff = computed(() => !!this.selectedLeaveType()?.isCompOff);

  readonly selectedBalance = computed(() =>
    this.leaveBalances().find(b => b.leaveTypeId === this.leaveTypeId()) ?? null);

  readonly selectedBalanceIsZero = computed(() => {
    const bal = this.selectedBalance();
    return bal !== null && bal.remainingDays === 0;
  });

  readonly selectedBalanceIsHalfOnly = computed(() => {
    const bal = this.selectedBalance();
    return bal !== null && bal.remainingDays === 0.5;
  });

  readonly encashBalance = computed(() =>
    this.leaveBalances().find(b => b.leaveTypeId === this.encashLeaveTypeId()) ?? null);

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    const t = this.hubType();
    if (t === 'encashment') {
      if (!this.encashLeaveTypeId()) return false;
      const bal = this.encashBalance();
      if (bal && this.encashDays() > bal.remainingDays) return false;
      return this.encashDays() >= 1;
    }
    if (t === 'leave') {
      if (!this.leaveTypeId() || !this.fromDate() || !this.toDate()) return false;
      if (this.toDate() < this.fromDate()) return false;
      if (this.halfDay() && this.fromDate() !== this.toDate()) return false;
      if (this.isCompOff() && !this.workedDate()) return false;
      return true;
    }
    const d = this.fromDate();
    // WFH and on-duty allow future dates; missed punch and correction are past-only
    const dateOk = t === 'wfh' || t === 'on_duty'
      ? !!d && d >= this.todayIso
      : !!d && d <= this.todayIso;
    if (t === 'wfh') return dateOk;
    return dateOk && !!this.clockIn();
  });

  // ── Permissions ───────────────────────────────────────────────────────
  readonly canApprove = (() => {
    const u = this.appState.user();
    return !!(u?.isManager || u?.isHr || u?.isAdmin);
  })();

  private _fromCalendar = false;

  // ── History ───────────────────────────────────────────────────────────
  myAttendance   = signal<AttendanceRequestResponse[]>([]);
  myLeaveRecords = signal<LeaveRecord[]>([]);
  loadingHistory = signal(false);
  historyFetched = signal(false);
  busyId         = signal<string | null>(null);

  // ── Approvals ─────────────────────────────────────────────────────────
  pending         = signal<AttendanceRequestResponse[]>([]);
  approvalsBusyId = signal<string | null>(null);
  rejectTarget    = signal<string | null>(null);
  rejectReason    = signal('');

  readonly hasApprovals = computed(() => this.pending().length > 0);

  // ── Lifecycle ─────────────────────────────────────────────────────────
  constructor() {
    // Auto-enable half-day (and lock it) when exactly 0.5 days remain
    effect(() => {
      if (this.selectedBalanceIsHalfOnly()) {
        this.halfDay.set(true);
        this.toDate.set(this.fromDate());
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadLeaveData();
    this.loadOffices();
    if (this.canApprove) this.loadPending();

    this.route.queryParams.subscribe(params => {
      const t = params['type'] as HubType;
      if (t && this.hubTypes.some(h => h.value === t)) {
        this.hubType.set(t);
      }
      if (params['leaveTypeId']) {
        this.leaveTypeId.set(params['leaveTypeId']);
      }
      if (params['date']) {
        this.fromDate.set(params['date']);
        this.toDate.set(params['date']);
      }
      if (params['fromCalendar'] === '1') {
        this._fromCalendar = true;
        this.clockIn.set('09:00');
        this.clockOut.set('18:30');
      }
    });
  }

  private loadLeaveData() {
    this.leaveSvc.types().subscribe({
      next: t => this.leaveTypes.set(t),
      error: (e) => {
        if (e?.status === 422 && e?.error?.code === 'gender_not_set') {
          this.toast.warning('Profile incomplete', 'Your gender isn\'t set. Please contact your admin to update your profile.');
        }
      },
    });
    this.leaveSvc.balances().subscribe({ next: b => this.leaveBalances.set(b), error: () => {} });
  }

  private loadOffices() {
    this.officeSvc.getAll().subscribe({
      next: (res) => {
        const raw = res.data ?? [];
        const seen = new Set<string>();
        const unique = raw.filter((o: any) => !seen.has(o.id) && seen.add(o.id));
        this.officeOptions.set([
          { label: 'No specific office', value: '' },
          ...unique.map((o: any) => ({ label: o.name, value: o.id })),
        ]);
        if (this._fromCalendar && !this.officeId() && unique.length > 0) {
          this.officeId.set(unique[0].id);
        }
      },
      error: () => {},
    });
  }

  loadPending() {
    this.svc.pendingApproval().subscribe({
      next: rows => this.pending.set(rows),
      error: () => this.pending.set([]),
    });
  }

  // ── Tab & type selection ──────────────────────────────────────────────
  switchTab(tab: HubTab) {
    this.activeTab.set(tab);
    if (tab === 'history' && !this.historyFetched()) this.loadHistory();
  }

  selectType(t: HubType) {
    this.hubType.set(t);
    this.resetForm();
  }

  private loadHistory() {
    this.loadingHistory.set(true);
    this.historyFetched.set(true);
    this.svc.mine().subscribe({
      next: rows => this.myAttendance.set(rows),
      error: () => {},
    });
    this.leaveSvc.my().subscribe({
      next: res => { this.myLeaveRecords.set(res.records ?? []); this.loadingHistory.set(false); },
      error: () => this.loadingHistory.set(false),
    });
  }

  private resetForm() {
    this.fromDate.set(this.todayIso);
    this.toDate.set(this.todayIso);
    this.reason.set('');
    this.clockIn.set('');
    this.clockOut.set('');
    this.officeId.set('');
    this.halfDay.set(false);
    this.workedDate.set('');
    this.leaveTypeId.set('');
  }

  // ── Form events ───────────────────────────────────────────────────────
  onHalfDayToggle(on: boolean) {
    this.halfDay.set(on);
    if (on) this.toDate.set(this.fromDate());
  }

  onFromChange(v: string) {
    this.fromDate.set(v);
    if (this.halfDay() || this.toDate() < v) this.toDate.set(v);
  }

  // ── Submit ────────────────────────────────────────────────────────────
  submit() {
    if (!this.canSubmit()) return;
    if (this.hubType() === 'encashment') {
      this.submitEncashment();
      return;
    }
    if (this.hubType() === 'leave') {
      this.submitLeave();
    } else {
      this.submitAttendance(this.hubType() as AttendanceRequestType);
    }
  }

  private submitLeave() {
    this.submitting.set(true);
    this.leaveSvc.apply({
      leaveTypeId:    this.leaveTypeId(),
      fromDate:       this.fromDate(),
      toDate:         this.toDate(),
      reason:         this.reason()    || undefined,
      halfDay:        this.halfDay(),
      halfDaySession: this.halfDay()   ? this.halfDaySession() : undefined,
      workedDate:     this.isCompOff() ? (this.workedDate() || undefined) : undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Leave applied', 'Your request has been submitted.');
        this.resetForm();
        this.historyFetched.set(false);
      },
      error: err => {
        this.submitting.set(false);
        this.toast.error('Could not apply', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  private submitEncashment() {
    this.submitting.set(true);
    this.leaveSvc.encashLeave(this.encashLeaveTypeId(), this.encashDays()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.toast.success('Leave encashed', `${this.encashDays()} day(s) encashed. ${res.remainingDays} days remaining.`);
        this.encashLeaveTypeId.set('');
        this.encashDays.set(1);
        // Refresh balances
        this.leaveSvc.balances().subscribe({ next: b => this.leaveBalances.set(b), error: () => {} });
      },
      error: (err) => {
        this.submitting.set(false);
        const status = err?.status;
        const msg = err?.error?.message;
        if (status === 409) this.toast.error('Encashment denied', msg ?? 'Policy or balance limit reached.');
        else if (status === 404) this.toast.error('Leave type not found', 'The selected leave type does not support encashment.');
        else this.toast.error('Encashment failed', msg ?? 'Please try again.');
      },
    });
  }

  private submitAttendance(type: AttendanceRequestType) {
    this.submitting.set(true);
    const clockInISO  = this.toISODateTime(this.fromDate(), this.clockIn());
    const clockOutISO = this.toISODateTime(this.fromDate(), this.clockOut());
    // WFH doesn't require specific clock times — others do
    if (type !== 'wfh' && !clockInISO) {
      this.submitting.set(false);
      this.toast.error('Clock-in required', 'Please enter the clock-in time.');
      return;
    }
    this.svc.create({
      date:     this.fromDate(),
      type,
      clockIn:  clockInISO,
      clockOut: clockOutISO,
      officeId: this.officeId() || undefined,
      reason:   this.reason()   || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Request submitted', 'Your attendance request is awaiting approval.');
        this.resetForm();
        this.historyFetched.set(false);
      },
      error: err => {
        this.submitting.set(false);
        this.toast.error('Could not submit', err?.error?.message ?? 'Please try again.');
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

  // ── History actions ───────────────────────────────────────────────────
  cancelAttendance(id: string) {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.svc.cancel(id).subscribe({
      next: () => { this.busyId.set(null); this.loadHistory(); },
      error: err => {
        this.busyId.set(null);
        this.toast.error('Could not cancel', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  cancelLeave(id: string) {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.leaveSvc.cancel(id).subscribe({
      next: () => { this.busyId.set(null); this.loadHistory(); },
      error: err => {
        this.busyId.set(null);
        this.toast.error('Could not cancel', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  canCancelLeave(r: LeaveRecord): boolean {
    return r.status === 'pending' || (r.status === 'approved' && r.fromDate > this.todayIso);
  }

  // ── Approvals ─────────────────────────────────────────────────────────
  approve(id: string) {
    if (this.approvalsBusyId()) return;
    this.approvalsBusyId.set(id);
    this.svc.decision(id, { approve: true }).subscribe({
      next: () => { this._removePending(id); this.approvalsBusyId.set(null); },
      error: err => {
        this.approvalsBusyId.set(null);
        this.toast.error('Could not approve', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  openReject(id: string)  { this.rejectTarget.set(id); this.rejectReason.set(''); }
  cancelReject()          { this.rejectTarget.set(null); }

  doReject() {
    const id = this.rejectTarget();
    if (!id) return;
    this.approvalsBusyId.set(id);
    this.svc.decision(id, { approve: false, rejectionReason: this.rejectReason() || undefined }).subscribe({
      next: () => { this._removePending(id); this.rejectTarget.set(null); this.approvalsBusyId.set(null); },
      error: err => {
        this.approvalsBusyId.set(null);
        this.toast.error('Could not reject', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  private _removePending(id: string) { this.pending.update(l => l.filter(r => r.id !== id)); }

  // ── Helpers ───────────────────────────────────────────────────────────
  typeLabel(t: AttendanceRequestType): string { return ATTENDANCE_REQUEST_TYPE_LABELS[t] ?? t; }

  hubLabel(t: HubType): string {
    return this.hubTypes.find(h => h.value === t)?.label ?? t;
  }

  /** Format an ISO datetime string (e.g. "2026-07-01T03:30:00Z") or HH:MM to "3:30 AM" */
  formatTime(raw: string | null | undefined): string {
    if (!raw) return '—';
    if (/^\d{2}:\d{2}$/.test(raw)) {
      const [h, m] = raw.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 || 12;
      return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    try {
      return this.loc.formatTime(raw);
    } catch {
      return raw;
    }
  }
}
