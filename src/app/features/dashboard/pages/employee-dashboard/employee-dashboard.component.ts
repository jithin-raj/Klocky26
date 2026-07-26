import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { LeaveService } from '../../../../core/services/leave.service';
import { TaskService } from '../../../../core/services/task.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { UiIconComponent, UiIconName } from '../../../../shared/components';
import { IconClockInComponent, IconClockOutComponent } from '../../../../shared/icons';
import { LocalizationService } from '../../../../core/services/localization.service';
import { LeaveBalance } from '../../../../core/models/leave.model';
import { CalendarDay, CalendarSummary } from '../../../../core/models/attendance.model';
import { TaskCounts } from '../../../../core/models/task.model';

interface Activity {
  action: string;
  time: string;
  date: string;
  type: 'in' | 'out' | 'leave' | 'absent' | 'holiday';
}

interface QuickAction {
  label: string;
  sub: string;
  icon: UiIconName;
  route: string;
  color: string;
  queryParams?: Record<string, string>;
}

interface MonthSeg { label: string; count: number; color: string; }

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, UiIconComponent, IconClockInComponent, IconClockOutComponent],
  templateUrl: './employee-dashboard.component.html',
  styleUrl: './employee-dashboard.component.scss',
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  constructor(private router: Router) {
    // Keep the hero clock-in/out state and "Today's Hours" ticking in sync with
    // the real attendance state — whether the user clocked in here, from the
    // header, on another device, or before this page mounted (SignalR + the
    // shell's refreshToday() drive clockInTime).
    effect(() => {
      const start = this.attendanceSvc.clockInTime();
      if (start) {
        this._renderHours(start);   // immediate, don't wait for the first tick
        this._startTimer();
      } else {
        this._stopTimer();
        this.todayHours.set('0h 00m');
      }
    });
  }

  readonly attendanceSvc = inject(AttendanceStateService);
  private  appState      = inject(AppStateService);
  private  loc           = inject(LocalizationService);
  private  leaveSvc      = inject(LeaveService);
  private  taskSvc       = inject(TaskService);
  readonly notificationSvc = inject(NotificationService);

  // Org-scoped route prefix for routerLink bindings
  orgPrefix = computed(() => `/${this.appState.orgUrlName() || 'default'}`);

  // ── Logged-in user ──────────────────────────────────────────────
  firstName = computed(() => {
    const u = this.appState.user();
    return u?.firstName?.trim() || u?.fullName?.split(' ')[0] || 'there';
  });
  fullName = computed(() => this.appState.user()?.fullName?.trim() || 'My Profile');
  userMeta = computed(() => {
    const u = this.appState.user();
    return u?.designationTitle || u?.departmentName || '';
  });
  avatarUrl = computed(() => this.appState.user()?.avatarUrl || '');
  initials = computed(() => {
    const u = this.appState.user();
    const a = (u?.firstName?.[0] ?? '') + (u?.lastName?.[0] ?? '');
    return (a || u?.fullName?.[0] || u?.email?.[0] || 'U').toUpperCase();
  });

  /** "Good morning / afternoon / evening" by local time. */
  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  // ── Real data ───────────────────────────────────────────────────
  readonly leaveBalances = signal<LeaveBalance[]>([]);
  readonly leaveLoading  = signal(true);

  readonly summary   = signal<CalendarSummary | null>(null);
  readonly calDays   = signal<CalendarDay[]>([]);
  readonly attLoading = signal(true);

  readonly taskCounts = signal<TaskCounts | null>(null);

  ngOnInit(): void {
    const now = new Date();

    this.leaveSvc.balances().subscribe({
      next: (b) => { this.leaveBalances.set(b ?? []); this.leaveLoading.set(false); },
      error: () => this.leaveLoading.set(false),
    });

    this.attendanceSvc.getCalendar(now.getFullYear(), now.getMonth() + 1).subscribe({
      next: (res) => {
        this.summary.set(res.data?.summary ?? null);
        this.calDays.set(res.data?.days ?? []);
        this.attLoading.set(false);
      },
      error: () => this.attLoading.set(false),
    });

    this.taskSvc.getCounts().subscribe({
      next: (c) => this.taskCounts.set(c),
      error: () => {},
    });

    this.notificationSvc.load();
  }

  // ── Derived real figures ────────────────────────────────────────
  presentDays  = computed(() => this.summary()?.presentDays ?? 0);
  leaveLeft    = computed(() => this.leaveBalances().reduce((s, b) => s + (b.remainingDays ?? 0), 0));
  pendingTasks = computed(() => this.taskCounts()?.total ?? 0);
  leaveUsed    = computed(() => this.leaveBalances().reduce((s, b) => s + (b.usedDays ?? 0), 0));

  /** Segmented "This Month" attendance breakdown, real values only. */
  monthSegs = computed<MonthSeg[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Present', count: s.presentDays, color: '#10b981' },
      { label: 'Half day', count: s.halfDays,   color: '#0ea5e9' },
      { label: 'Leave',    count: s.leaveDays,   color: '#f59e0b' },
      { label: 'Absent',   count: s.absentDays,  color: '#ef4444' },
      { label: 'Holiday',  count: s.holidayDays, color: '#8b5cf6' },
    ].filter(x => x.count > 0);
  });
  monthTotal = computed(() => this.monthSegs().reduce((s, x) => s + x.count, 0));

  /** Recent activity built from real calendar days (most recent first). */
  recentActivity = computed<Activity[]>(() => {
    const days = this.calDays().filter(d => !d.isUpcoming);
    const acts: Activity[] = [];
    for (let i = days.length - 1; i >= 0 && acts.length < 6; i--) {
      const d = days[i];
      const when = this._relDate(d.date);
      if (d.clockOutTime) acts.push({ action: 'Clocked out', time: this._fmtClock(d.clockOutTime), date: when, type: 'out' });
      if (d.clockInTime)  acts.push({ action: 'Clocked in',  time: this._fmtClock(d.clockInTime),  date: when, type: 'in' });
      if (!d.clockInTime && d.isLeave)    acts.push({ action: 'On leave', time: '', date: when, type: 'leave' });
      if (!d.clockInTime && d.isHoliday)  acts.push({ action: d.holidayName || 'Holiday', time: '', date: when, type: 'holiday' });
    }
    return acts.slice(0, 6);
  });

  /** Current week Mon→Sun, mapped from real calendar days. */
  weekStrip = computed(() => {
    const byDate = new Map(this.calDays().map(d => [d.date, d]));
    const now = new Date();
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0 = Monday
    monday.setDate(now.getDate() - dow);
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return labels.map((lbl, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const day = byDate.get(iso);
      const isToday = iso === this._isoToday();
      return {
        label: lbl,
        date: dt.getDate(),
        status: (day?.status ?? 'upcoming') as string,
        color: this._statusColor(day?.status),
        isToday,
      };
    });
  });

  // Recent notifications shown as "Updates"
  updates = computed(() => this.notificationSvc.items().slice(0, 3));

  quickActions = computed<QuickAction[]>(() => {
    const pending = this.pendingTasks();
    return [
      { label: 'Apply Leave',     sub: `${this.leaveLeft()} days available`, icon: 'calendar',        route: 'app/tasks',      color: '#f59e0b', queryParams: { new: 'leave' } },
      { label: 'View Attendance', sub: `${this.presentDays()} present this month`, icon: 'clock',     route: 'app/attendance', color: '#0ea5e9' },
      { label: 'My Tasks',        sub: pending ? `${pending} pending` : 'All caught up', icon: 'clipboard-check', route: 'app/tasks', color: '#10b981' },
      { label: 'My Profile',      sub: 'View details',      icon: 'user',            route: 'app/profile',    color: '#8b5cf6' },
    ];
  });

  onQuickAction(a: QuickAction): void {
    this.router.navigate([this.orgPrefix(), ...a.route.split('/')], { queryParams: a.queryParams });
  }

  // Shorthand getters for template
  get isClockedIn()  { return this.attendanceSvc.isClockedIn; }
  get geoStatus()    { return this.attendanceSvc.geoStatus; }

  clockOutConfirmPending = signal(false);

  /** Toggle clock — location captured silently; no pre-confirmation modal for clock-in */
  toggleClock(): void {
    if (this.attendanceSvc.isClockedIn()) {
      this.clockOutConfirmPending.set(true);
    } else {
      this._startGeoClockIn();
    }
  }

  private _startGeoClockIn(): void {
    const method = (window as any).ReactNativeWebView ? 'mobile' : 'web';
    const readLocation = !!this.appState.user()?.locationRequiredOnClockIn;
    if (!readLocation || !navigator.geolocation) {
      this.attendanceSvc.clockIn(method, {});
      return;
    }
    this.attendanceSvc.geoStatus.set('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.attendanceSvc.geoStatus.set('idle');
        this.attendanceSvc.clockIn(method, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        this.attendanceSvc.geoStatus.set('idle');
        this.attendanceSvc.clockIn(method, {});
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  confirmClockOut(): void {
    this.clockOutConfirmPending.set(false);
    this.attendanceSvc.manualClockOut();
  }

  cancelClockOut(): void {
    this.clockOutConfirmPending.set(false);
  }

  now = new Date();
  todayHours = signal('0h 00m');

  private timerRef?: ReturnType<typeof setInterval>;

  /** @deprecated internal only — use toggleClock() */
  clockIn(): void { this._startGeoClockIn(); }

  private _renderHours(start: Date) {
    const diff = Date.now() - start.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    this.todayHours.set(`${h}h ${String(m).padStart(2, '0')}m`);
  }

  private _startTimer() {
    this._stopTimer();
    this.timerRef = setInterval(() => {
      const t = this.attendanceSvc.clockInTime();
      if (!t) { this._stopTimer(); return; }
      this._renderHours(t);
    }, 10000);
  }

  private _stopTimer() {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = undefined; }
  }

  formatTime(d: Date): string {
    return this.loc.formatTime(d);
  }

  ngOnDestroy() {
    this._stopTimer();
  }

  leavePercent(b: LeaveBalance): number {
    const total = b.totalDays || 0;
    if (!total) return 0;
    return Math.min(100, Math.round((b.usedDays / total) * 100));
  }

  activityColor(type: Activity['type']): string {
    const map: Record<Activity['type'], string> = {
      in: '#10b981', out: '#6366f1', leave: '#f59e0b', absent: '#ef4444', holiday: '#06b6d4',
    };
    return map[type];
  }

  fmtNotifDate(iso: string): string {
    return this._relDate(iso.slice(0, 10));
  }

  // ── Small date/format helpers ───────────────────────────────────
  private _isoToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private _relDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return iso;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return this.loc.formatDateOnly(iso);
  }
  private _fmtClock(s: string): string {
    if (!s) return '';
    const d = new Date(/[T:]/.test(s) && /\d{4}-\d{2}-\d{2}/.test(s) ? s : `1970-01-01T${s}`);
    return isNaN(d.getTime()) ? s : this.loc.formatTime(d);
  }
  private _statusColor(status?: string): string {
    const map: Record<string, string> = {
      present: '#10b981', half_day: '#0ea5e9', overtime: '#14b8a6',
      leave: '#f59e0b', absent: '#ef4444', holiday: '#8b5cf6',
      comp_off: '#a855f7', weekend: '#cbd5e1', upcoming: '#e2e8f0',
    };
    return map[status ?? 'upcoming'] ?? '#e2e8f0';
  }
}
