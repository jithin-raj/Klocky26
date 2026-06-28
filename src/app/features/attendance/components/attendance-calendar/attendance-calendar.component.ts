import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
  Input,
  HostListener,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import {
  AttendanceRecordResponse,
  CalendarDayStatus,
  CalendarResponse,
} from '../../../../core/models/attendance.model';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'present'
  | 'half'
  | 'absent'
  | 'leave'
  | 'comp_off'
  | 'holiday'
  | 'off';

export interface AttendanceRecord {
  /** ISO date string YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  /** Actual working hours for the day */
  hours?: number;
  /** Holiday name e.g. 'Vishu', 'Christmas' */
  holidayName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

export interface DayCell {
  date: Date;
  day: number;
  status: AttendanceStatus | null;
  isOff: boolean;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  hours?: number;
  hoursMet: boolean;
  holidayName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  present:  { label: 'Present',  color: '#16a34a', bg: '#dcfce7' },
  half:     { label: 'Half Day', color: '#d97706', bg: '#fef3c7' },
  absent:   { label: 'Absent',   color: '#dc2626', bg: '#fee2e2' },
  leave:    { label: 'Leave',    color: '#ea580c', bg: '#ffedd5' },
  comp_off: { label: 'Comp Off', color: '#0891b2', bg: '#cffafe' },
  holiday:  { label: 'Holiday',  color: '#7c3aed', bg: '#ede9fe' },
  off:      { label: 'Weekend',  color: '#f87171', bg: '#fff5f5' },
};

const REQUIRED_HOURS: Partial<Record<AttendanceStatus, number>> = {
  present: 8,
  half: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-attendance-calendar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-calendar.component.html',
  styleUrl: './attendance-calendar.component.scss',
})
export class AttendanceCalendarComponent implements AfterViewInit, OnDestroy {

  // ── Inputs ────────────────────────────────────────────────────────────────

  private readonly attendance = inject(AttendanceStateService);
  private readonly realtime   = inject(RealtimeService);
  private _liveSub?: Subscription;

  /** Optional — admin/HR view another employee's calendar; omit for the caller's own. */
  @Input() set userId(val: string | undefined) { this._userId.set(val); }
  private readonly _userId = signal<string | undefined>(undefined);

  constructor(private _el: ElementRef<HTMLElement>) {
    // Fetch whenever the visible month or the targeted user changes.
    effect(() => {
      const { year, month } = this._ym();
      const userId = this._userId();
      this._fetchMonth(year, month, userId);
    });

    // Live: patch the open month when an attendance record for it changes.
    this._liveSub = this.realtime.on<AttendanceRecordResponse>('attendance.updated')
      .subscribe((rec) => this._applyLiveRecord(rec));
  }

  ngAfterViewInit(): void {
    // Register as non-passive so preventDefault() can block the page scroll
    this._el.nativeElement.addEventListener('wheel', this._wheelHandler, { passive: false });
  }

  ngOnDestroy(): void {
    this._el.nativeElement.removeEventListener('wheel', this._wheelHandler);
    this._liveSub?.unsubscribe();
  }

  private readonly _wheelHandler = (e: WheelEvent): void => this.onWheel(e);

  @Input() set records(val: AttendanceRecord[]) {
    this._recordMap.set(this._toMap(val));
  }

  @Input() set holidays(val: { date: string; name: string }[]) {
    this._holidayMap.set(val.reduce((a, h) => ({ ...a, [h.date]: h.name }), {}));
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  readonly loadingMonth = signal(false);

  private _fetchMonth(year: number, month: number, userId?: string): void {
    this.loadingMonth.set(true);
    // month is 0-based internally; the API expects 1-based.
    this.attendance.getCalendar(year, month + 1, userId).subscribe({
      next: (res) => { this._ingest(res?.data); this.loadingMonth.set(false); },
      error: () => { this.loadingMonth.set(false); /* soft — keep whatever is shown */ },
    });
  }

  /** Fold a CalendarResponse into the record/holiday maps the grid renders from. */
  private _ingest(res: CalendarResponse | null | undefined): void {
    if (!res) return;
    const records: Record<string, AttendanceRecord> = {};
    const holidays: Record<string, string> = {};
    for (const day of res.days) {
      const status = this._mapStatus(day.status);
      // Weekends + future days carry no record — the grid derives those itself.
      if (status) {
        const hours = day.hoursWorked ?? day.presentHours ?? undefined;
        records[day.date] = {
          date: day.date,
          status,
          ...(hours != null ? { hours } : {}),
          ...(day.holidayName ? { holidayName: day.holidayName } : {}),
        };
      }
      if (day.holidayName) holidays[day.date] = day.holidayName;
    }
    this._recordMap.set(records);
    this._holidayMap.set(holidays);
  }

  /** Patch a single day in-place when SignalR reports it (current open month only). */
  private _applyLiveRecord(rec: AttendanceRecordResponse | null): void {
    if (!rec?.date) return;
    // Ignore pushes for a different user than the one being viewed.
    if (this._userId() && rec.userId !== this._userId()) return;
    const { year, month } = this._ym();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!rec.date.startsWith(prefix)) return;

    const status = this._mapStatus(rec.status as CalendarDayStatus);
    if (!status) return;
    const hours = rec.hoursWorked ?? undefined;
    this._recordMap.update(map => {
      const holidayName = map[rec.date]?.holidayName;
      return {
        ...map,
        [rec.date]: {
          date: rec.date,
          status,
          ...(hours != null ? { hours } : {}),
          ...(holidayName ? { holidayName } : {}),
        },
      };
    });
  }

  /** API status string → the grid's internal status (null = let the grid derive it: weekend/future). */
  private _mapStatus(s: CalendarDayStatus | AttendanceStatus): AttendanceStatus | null {
    switch (s) {
      case 'present':  return 'present';
      case 'half_day':
      case 'half':     return 'half';
      case 'absent':   return 'absent';
      case 'leave':    return 'leave';
      case 'comp_off': return 'comp_off';
      case 'holiday':  return 'holiday';
      case 'weekend':
      case 'off':      return null;   // grid marks Sat/Sun as off itself
      case 'upcoming': return null;   // future day — no record
      default:         return null;
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  readonly dayHeaders = DAYS;

  readonly legendItems = Object.entries(STATUS_META).map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
  }));

  readonly today = new Date();
  readonly viewDate = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  readonly _recordMap = signal<Record<string, AttendanceRecord>>({});
  readonly _holidayMap = signal<Record<string, string>>({});

  /** Currently "active" cell on mobile (tap to magnify) */
  activeCell: DayCell | null = null;

  /** Controls the summary accordion open/closed state */
  summaryOpen = signal(false);

  /** 'calendar' | 'list' */
  viewMode = signal<'calendar' | 'list'>('calendar');

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly monthYear = computed(() =>
    this.viewDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  readonly weeks = computed((): (DayCell | null)[][] => {
    const { year, month } = this._ym();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const map = this._recordMap();
    const hmap = this._holidayMap();

    const cells: (DayCell | null)[] = Array(firstDow).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dow = date.getDay();
      const isOff = dow === 0 || dow === 6;
      const key = this._key(year, month, d);
      const isFuture = date > this.today;
      const isToday = this._sameDay(date, this.today);
      const isPast = !isFuture && !isToday;
      const rec = map[key];
      const status: AttendanceStatus | null = isOff ? 'off' : (rec?.status ?? null);
      const hours = rec?.hours;
      const holidayName = rec?.holidayName ?? hmap[key];
      const required = status ? (REQUIRED_HOURS[status] ?? undefined) : undefined;
      const hoursMet = hours !== undefined && required !== undefined ? hours >= required : true;
      cells.push({ date, day: d, status, isOff, isToday, isFuture, isPast, hours, hoursMet, holidayName });
    }

    const weeks: (DayCell | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  });

  readonly summaryChips = computed(() => {
    const { year, month } = this._ym();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const map = this._recordMap();
    const counts: Record<string, number> = { present: 0, half: 0, absent: 0, leave: 0, comp_off: 0, holiday: 0 };

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date > this.today) continue;
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const s = map[this._key(year, month, d)]?.status;
      if (s && s !== 'off' && counts[s] !== undefined) counts[s]++;
    }

    return (['present', 'half', 'absent', 'leave', 'comp_off', 'holiday'] as AttendanceStatus[]).map(k => ({
      key: k,
      count: counts[k],
      label: STATUS_META[k].label,
      color: STATUS_META[k].color,
      bg:    STATUS_META[k].bg,
    }));
  });

  readonly workStats = computed(() => {    const { year, month } = this._ym();
    const map = this._recordMap();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalHours = 0;
    let workingDays = 0;
    let overtime = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const rec = map[this._key(year, month, d)];
      if (!rec || rec.hours === undefined) continue;
      const required = REQUIRED_HOURS[rec.status] ?? 0;
      if (required === 0) continue;
      totalHours += rec.hours;
      workingDays++;
      if (rec.hours > required) overtime += rec.hours - required;
    }

    return {
      avgHours: workingDays > 0 ? Math.round((totalHours / workingDays) * 10) / 10 : 0,
      overtimeHours: Math.round(overtime * 10) / 10,
    };
  });

  readonly listRows = computed(() => {
    const { year, month } = this._ym();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const map = this._recordMap();
    const hmap = this._holidayMap();
    const rows: DayCell[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dow = date.getDay();
      const isOff = dow === 0 || dow === 6;
      const key = this._key(year, month, d);
      const isFuture = date > this.today;
      const isToday = this._sameDay(date, this.today);
      const isPast = !isFuture && !isToday;
      const rec = map[key];
      const status: AttendanceStatus | null = isOff ? 'off' : (rec?.status ?? null);
      const hours = rec?.hours;
      const holidayName = rec?.holidayName ?? hmap[key];
      const required = status ? (REQUIRED_HOURS[status] ?? undefined) : undefined;
      const hoursMet = hours !== undefined && required !== undefined ? hours >= required : true;
      rows.push({ date, day: d, status, isOff, isToday, isFuture, isPast, hours, hoursMet, holidayName });
    }
    return rows;
  });

  // ── Month navigation ──────────────────────────────────────────────────────

  toggleSummary(): void {
    this.summaryOpen.update(v => !v);
  }

  setView(mode: 'calendar' | 'list'): void {
    this.viewMode.set(mode);
  }

  private _touchStartX = 0;
  private _touchStartY = 0;
  private _wheelCooldown = false;

  onWheel(e: WheelEvent): void {
    if (this._wheelCooldown) return;

    const isDesktop = window.innerWidth > 600;

    if (isDesktop) {
      // Desktop / laptop: vertical scroll (mouse wheel or trackpad up/down)
      if (Math.abs(e.deltaY) >= 30) {
        e.preventDefault();
        this._wheelCooldown = true;
        if (e.deltaY > 0) this.nextMonth();
        else this.prevMonth();
        setTimeout(() => { this._wheelCooldown = false; }, 600);
        return;
      }
    }

    // Horizontal trackpad swipe (all screen sizes)
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 2) return;
    this._wheelCooldown = true;
    if (e.deltaX > 30) this.nextMonth();
    else if (e.deltaX < -30) this.prevMonth();
    setTimeout(() => { this._wheelCooldown = false; }, 600);
  }

  onTouchStart(e: TouchEvent): void {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    const deltaX = this._touchStartX - e.changedTouches[0].clientX;
    const deltaY = this._touchStartY - e.changedTouches[0].clientY;
    // Require gesture to be at least 2.5× more horizontal than vertical
    // (~22° from horizontal) to avoid triggering on vertical page scrolls
    if (Math.abs(deltaX) < Math.abs(deltaY) * 2.5) return;
    if (deltaX > 40) this.nextMonth();
    else if (deltaX < -40) this.prevMonth();
  }

  prevMonth(): void {
    const { year, month } = this._ym();
    this.viewDate.set(new Date(year, month - 1, 1));
    this.activeCell = null;
  }

  nextMonth(): void {
    const { year, month } = this._ym();
    this.viewDate.set(new Date(year, month + 1, 1));
    this.activeCell = null;
  }

  // ── Cell interaction ──────────────────────────────────────────────────────

  /** Toggle active (mobile tap-to-magnify) */
  toggleActive(cell: DayCell): void {
    this.activeCell = this.activeCell === cell ? null : cell;
  }

  /** Dismiss active cell when clicking outside any cell */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.cal-cell')) {
      this.activeCell = null;
    }
  }

  // ── Cell display helpers ──────────────────────────────────────────────────

  cellColor(cell: DayCell): string {
    return cell.status ? STATUS_META[cell.status].color : '';
  }

  cellBg(cell: DayCell): string {
    return cell.status ? STATUS_META[cell.status].bg : '';
  }

  cellTitle(cell: DayCell): string {
    const ds = cell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const label = cell.status ? STATUS_META[cell.status].label : 'No record';
    const holiday = cell.holidayName ? ` — ${cell.holidayName}` : '';
    const hrs = cell.hours !== undefined ? ` | ${cell.hours}h worked` : '';
    return `${ds}${holiday} — ${label}${hrs}`;
  }

  requiredHours(cell: DayCell): number {
    return cell.status ? (REQUIRED_HOURS[cell.status] ?? 8) : 8;
  }

  /** Human label for a status (handles multi-word statuses like comp_off). */
  statusLabel(status: AttendanceStatus): string {
    return STATUS_META[status]?.label ?? status;
  }

  /**
   * Returns an array of dot states for the hours indicator.
   * Each dot = 1 hour. Extra time gets an indigo dot.
   */
  dotArray(cell: DayCell): Array<'filled' | 'empty' | 'extra'> {
    if (cell.hours === undefined) return [];
    const required = this.requiredHours(cell);
    const result: Array<'filled' | 'empty' | 'extra'> = [];
    for (let i = 0; i < required; i++) {
      result.push(cell.hours > i ? 'filled' : 'empty');
    }
    if (cell.hours > required) result.push('extra');
    return result;
  }

  /**
   * Returns fill % for cylinder.
   * Full day = 8h = 100%. Extra time beyond 8h overflows to 100% + purple.
   * Cap at 100% for the track height, use fill-extra class for colour.
   */
  fillPercent(cell: DayCell): number {
    if (cell.hours === undefined) return 0;
    const required = this.requiredHours(cell);
    return Math.min(100, Math.round((cell.hours / required) * 100));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _ym() {
    const d = this.viewDate();
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  private _key(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private _sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  private _toMap(records: AttendanceRecord[]): Record<string, AttendanceRecord> {
    return records.reduce((acc, r) => ({ ...acc, [r.date]: r }), {});
  }
}

