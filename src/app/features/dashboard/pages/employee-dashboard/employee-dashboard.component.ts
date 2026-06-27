import { Component, ChangeDetectionStrategy, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { UiIconComponent, UiIconName } from '../../../../shared/components';

interface LeaveBalance {
  type: string;
  used: number;
  total: number;
  color: string;
}

interface Shift {
  day: string;
  date: number;
  start: string;
  end: string;
  isToday: boolean;
}

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
}

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, UiIconComponent],
  templateUrl: './employee-dashboard.component.html',
  styleUrl: './employee-dashboard.component.scss',
})
export class EmployeeDashboardComponent implements OnDestroy {
  constructor(private router: Router) {}

  readonly attendanceSvc = inject(AttendanceStateService);
  private  appState      = inject(AppStateService);

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

  quickActions: QuickAction[] = [
    { label: 'Apply Leave',     sub: '1 pending request', icon: 'calendar',        route: 'app/leaves',     color: '#f59e0b' },
    { label: 'View Attendance', sub: '22 days present',   icon: 'clock',           route: 'app/attendance', color: '#0ea5e9' },
    { label: 'My Tasks',        sub: '5 tasks pending',   icon: 'clipboard-check', route: 'app/tasks',      color: '#10b981' },
    { label: 'My Profile',      sub: 'View details',      icon: 'user',            route: 'app/profile',    color: '#8b5cf6' },
  ];

  onQuickAction(a: QuickAction): void {
    this.router.navigate([this.orgPrefix(), ...a.route.split('/')]);
  }

  // Shorthand getters for template
  get isClockedIn()  { return this.attendanceSvc.isClockedIn; }
  get geoStatus()    { return this.attendanceSvc.geoStatus; }

  now = new Date();
  todayHours = signal('0h 00m');

  private timerRef?: ReturnType<typeof setInterval>;

  /**
   * Clock in via geolocation. No face verification today — there is no
   * backend face-verification endpoint yet. Once one exists, a 'face' method
   * clock-in should call attendanceSvc.clockIn('face', { photoUrl }) with an
   * uploaded capture instead of re-introducing client-side face matching here.
   */
  clockIn(): void {
    if (!navigator.geolocation) {
      this.attendanceSvc.clockIn('web');
      this._startTimer();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.attendanceSvc.clockIn('mobile', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        this._startTimer();
      },
      () => {
        this.attendanceSvc.clockIn('web');
        this._startTimer();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private _startTimer() {
    this._stopTimer();
    this.timerRef = setInterval(() => {
      const t = this.attendanceSvc.clockInTime();
      if (!t) { this._stopTimer(); return; }
      const diff = Date.now() - t.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      this.todayHours.set(`${h}h ${String(m).padStart(2, '0')}m`);
    }, 10000);
  }

  private _stopTimer() {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = undefined; }
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  ngOnDestroy() {
    this._stopTimer();
  }

  leaveBalances: LeaveBalance[] = [
    { type: 'Annual',      used: 5,  total: 18, color: '#6366f1' },
    { type: 'Sick',        used: 2,  total: 12, color: '#10b981' },
    { type: 'Casual',      used: 1,  total: 6,  color: '#f59e0b' },
    { type: 'Comp-off',    used: 0,  total: 3,  color: '#8b5cf6' },
  ];

  upcomingShifts: Shift[] = [
    { day: 'Mon', date: 28, start: '09:00', end: '18:00', isToday: false },
    { day: 'Tue', date: 29, start: '09:00', end: '18:00', isToday: false },
    { day: 'Wed', date: 30, start: '09:00', end: '18:00', isToday: false },
    { day: 'Thu', date: 1,  start: '09:00', end: '18:00', isToday: false },
    { day: 'Fri', date: 2,  start: '09:00', end: '18:00', isToday: false },
  ];

  recentActivity: Activity[] = [
    { action: 'Clocked In',   time: '09:02 AM', date: 'Today',     type: 'in'     },
    { action: 'Clocked Out',  time: '06:14 PM', date: 'Yesterday', type: 'out'    },
    { action: 'Clocked In',   time: '08:58 AM', date: 'Yesterday', type: 'in'     },
    { action: 'Leave Approved', time: '',       date: 'Apr 25',    type: 'leave'  },
    { action: 'Clocked Out',  time: '06:30 PM', date: 'Apr 24',    type: 'out'    },
  ];

  announcements = [
    { title: 'Public Holiday — May 1',   body: "Labour Day is an office holiday. Enjoy the long weekend!", date: 'Apr 26', tag: 'Holiday' },
    { title: 'Q2 Performance Reviews',   body: 'Self-assessments are due by May 5. Check your HR portal.', date: 'Apr 24', tag: 'HR' },
  ];

  activityColor(type: Activity['type']): string {
    const map: Record<Activity['type'], string> = {
      in: '#10b981', out: '#6366f1', leave: '#f59e0b', absent: '#ef4444', holiday: '#06b6d4',
    };
    return map[type];
  }

  leavePercent(b: LeaveBalance): number {
    return Math.round((b.used / b.total) * 100);
  }
}
