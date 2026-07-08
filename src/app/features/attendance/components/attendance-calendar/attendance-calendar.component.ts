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
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { AppStateService } from '../../../../core/services/app-state.service';
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
  /** Server-computed hours required for this day (shift-aware) — overrides the static present/half-day defaults when present */
  requiredHours?: number;
  /** Holiday name e.g. 'Vishu', 'Christmas' */
  holidayName?: string;
  /** Server-provided hex color (overrides STATUS_META when present) */
  color?: string;
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
  /** Resolved required hours for this cell — server value when present, else the static default. */
  requiredHours: number;
  holidayName?: string;
  /** Server-provided hex color, takes precedence over STATUS_META */
  color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  present:  { label: 'Present',  color: '#16A34A', bg: '#dcfce7' },
  half:     { label: 'Half Day', color: '#F59E0B', bg: '#fef3c7' },
  absent:   { label: 'Absent',   color: '#DC2626', bg: '#fee2e2' },
  leave:    { label: 'Leave',    color: '#3B82F6', bg: '#dbeafe' },
  comp_off: { label: 'Comp Off', color: '#8B5CF6', bg: '#ede9fe' },
  holiday:  { label: 'Holiday',  color: '#EC4899', bg: '#fce7f3' },
  off:      { label: 'Weekend',  color: '#94A3B8', bg: '#f1f5f9' },
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
  private readonly router     = inject(Router);
  private readonly appState   = inject(AppStateService);
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
    const dates: string[] = [];
    for (const day of res.days) {
      dates.push(day.date);
      const status = this._mapStatus(day.status);
      // Weekends + future days carry no record — the grid derives those itself.
      if (status) {
        const hours = day.hoursWorked ?? day.presentHours ?? undefined;
        records[day.date] = {
          date: day.date,
          status,
          ...(hours != null ? { hours } : {}),
          ...(day.requiredHours != null ? { requiredHours: day.requiredHours } : {}),
          ...(day.holidayName ? { holidayName: day.holidayName } : {}),
          ...(day.color ? { color: day.color } : {}),
        };
      }
      if (day.holidayName) holidays[day.date] = day.holidayName;
    }
    this._cycleDates.set(dates);
    this._recordMap.set(records);
    this._holidayMap.set(holidays);
  }

  /** Patch a single day in-place when SignalR reports it (current open cycle only). */
  private _applyLiveRecord(rec: AttendanceRecordResponse | null): void {
    if (!rec?.date) return;
    if (this._userId() && rec.userId !== this._userId()) return;

    // Accept the update only if the date belongs to the currently loaded cycle.
    // When _cycleDates is populated, use it; otherwise fall back to the month prefix.
    const cycle = this._cycleDates();
    if (cycle.length > 0) {
      if (!cycle.includes(rec.date)) return;
    } else {
      const { year, month } = this._ym();
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (!rec.date.startsWith(prefix)) return;
    }

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
      case 'off':      return 'off';
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
  readonly _recordMap  = signal<Record<string, AttendanceRecord>>({});
  readonly _holidayMap = signal<Record<string, string>>({});
  /** Ordered ISO dates for the current cycle as returned by the API. Empty until first fetch. */
  private readonly _cycleDates = signal<string[]>([]);

  /** Currently "active" cell on mobile (tap to magnify) and for the detail modal */
  activeCell: DayCell | null = null;

  /** The cell shown in the day-detail modal (null = modal closed) */
  readonly selectedCell = signal<DayCell | null>(null);

  /** Controls the summary accordion open/closed state */
  summaryOpen = signal(false);

  /** 'calendar' | 'list' */
  viewMode = signal<'calendar' | 'list'>('calendar');

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly monthYear = computed(() =>
    this.viewDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  readonly weeks = computed((): (DayCell | null)[][] => {
    const isoDates = this._cycleDates();
    const map  = this._recordMap();
    const hmap = this._holidayMap();

    // Fall back to standard month when the API hasn't responded yet
    const dates: Date[] = isoDates.length > 0
      ? isoDates.map(s => new Date(s + 'T00:00:00'))
      : (() => {
          const { year, month } = this._ym();
          const n = new Date(year, month + 1, 0).getDate();
          return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1));
        })();

    const firstDow = dates[0]?.getDay() ?? 0;
    const cells: (DayCell | null)[] = Array(firstDow).fill(null);

    for (const date of dates) {
      const dow = date.getDay();
      const isOff = dow === 0 || dow === 6;
      const key = this._dateKey(date);
      const isFuture = date > this.today;
      const isToday  = this._sameDay(date, this.today);
      const isPast   = !isFuture && !isToday;
      const rec = map[key];
      const holidayName = rec?.holidayName ?? hmap[key];
      const rawStatus: AttendanceStatus | null = rec?.status ?? (isOff ? 'off' : null);
      const status: AttendanceStatus | null =
        (rawStatus === null && !isFuture && !!holidayName) ? 'holiday' : rawStatus;
      const hours = rec?.hours;
      const required = this._requiredFor(status, rec);
      const hoursMet = hours !== undefined ? hours >= required : true;
      cells.push({ date, day: date.getDate(), status, isOff, isToday, isFuture, isPast, hours, hoursMet, requiredHours: required, holidayName, color: rec?.color });
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
    const isoDates = this._cycleDates();
    const map = this._recordMap();
    const counts: Record<string, number> = { present: 0, half: 0, absent: 0, leave: 0, comp_off: 0, holiday: 0 };

    const dates: Date[] = isoDates.length > 0
      ? isoDates.map(s => new Date(s + 'T00:00:00'))
      : (() => { const { year, month } = this._ym(); const n = new Date(year, month + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1)); })();

    for (const date of dates) {
      if (date > this.today) continue;
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const s = map[this._dateKey(date)]?.status;
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

  readonly workStats = computed(() => {
    const isoDates = this._cycleDates();
    const map = this._recordMap();

    const keys: string[] = isoDates.length > 0
      ? isoDates
      : (() => { const { year, month } = this._ym(); const n = new Date(year, month + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => this._key(year, month, i + 1)); })();

    let totalHours = 0;
    let workingDays = 0;
    let overtime = 0;

    for (const key of keys) {
      const rec = map[key];
      if (!rec || rec.hours === undefined) continue;
      const required = REQUIRED_HOURS[rec.status] ?? 0;
      if (required === 0) continue;
      totalHours += rec.hours;
      workingDays++;
      if (rec.hours > required) overtime += rec.hours - required;
    }

    const avg = workingDays > 0 ? totalHours / workingDays : 0;
    return {
      avgHours: avg > 0 ? this.formatHours(avg) : '0h',
      overtimeHours: overtime > 0 ? this.formatHours(overtime) : '0h',
    };
  });

  readonly listRows = computed(() => {
    const isoDates = this._cycleDates();
    const map  = this._recordMap();
    const hmap = this._holidayMap();

    const dates: Date[] = isoDates.length > 0
      ? isoDates.map(s => new Date(s + 'T00:00:00'))
      : (() => { const { year, month } = this._ym(); const n = new Date(year, month + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1)); })();

    return dates.map(date => {
      const dow = date.getDay();
      const isOff = dow === 0 || dow === 6;
      const key = this._dateKey(date);
      const isFuture = date > this.today;
      const isToday  = this._sameDay(date, this.today);
      const isPast   = !isFuture && !isToday;
      const rec = map[key];
      const status: AttendanceStatus | null = rec?.status ?? (isOff ? 'off' : null);
      const hours = rec?.hours;
      const holidayName = rec?.holidayName ?? hmap[key];
      const required = this._requiredFor(status, rec);
      const hoursMet = hours !== undefined ? hours >= required : true;
      return { date, day: date.getDate(), status, isOff, isToday, isFuture, isPast, hours, hoursMet, requiredHours: required, holidayName, color: rec?.color };
    });
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
    this._cycleDates.set([]);
    this.viewDate.set(new Date(year, month - 1, 1));
    this.activeCell = null;
    this.selectedCell.set(null);
  }

  nextMonth(): void {
    const { year, month } = this._ym();
    this._cycleDates.set([]);
    this.viewDate.set(new Date(year, month + 1, 1));
    this.activeCell = null;
    this.selectedCell.set(null);
  }

  // ── Cell interaction ──────────────────────────────────────────────────────

  /** Open the day-detail modal for a cell */
  openDetail(cell: DayCell): void {
    this.activeCell = cell;
    this.selectedCell.set(cell);
  }

  /** Close the day-detail modal */
  closeDetail(): void {
    this.activeCell = null;
    this.selectedCell.set(null);
  }

  /** Whether this cell can be regularized — absent/leave/no-record or requiredHours not met */
  canRegularize(cell: DayCell): boolean {
    if (cell.isFuture || cell.isOff || cell.status === 'holiday') return false;
    if (cell.status === 'absent' || cell.status === 'leave' || cell.status === null) return true;
    if ((cell.status === 'present' || cell.status === 'half') && cell.hours !== undefined && !cell.hoursMet) return true;
    return false;
  }

  /** Text shown in the regularize hint area */
  regularizeHint(cell: DayCell): string {
    if ((cell.status === 'present' || cell.status === 'half') && cell.hours !== undefined && !cell.hoursMet) {
      return `You logged ${this.formatHours(cell.hours)} — below the ${this.requiredHours(cell)}h required. Submit a correction.`;
    }
    return 'This day needs attendance regularization.';
  }

  /** Navigate to the attendance requests page with this date pre-selected */
  regularize(cell: DayCell): void {
    const org = this.appState.orgUrlName() || 'default';
    const date = this._cellDateKey(cell);
    this.closeDetail();
    this.router.navigate([`/${org}/app/attendance/requests`], {
      queryParams: { type: 'missed_punch', date, fromCalendar: '1' },
    });
  }

  /** YYYY-MM-DD string for a cell's date */
  private _cellDateKey(cell: DayCell): string {
    const d = cell.date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Human-readable date label for the modal header */
  detailDateLabel(cell: DayCell): string {
    return cell.date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** Toggle active (mobile tap-to-magnify) — kept for backward compat, now also opens modal */
  toggleActive(cell: DayCell): void {
    if (this.activeCell === cell) {
      this.closeDetail();
    } else {
      this.openDetail(cell);
    }
  }

  /** Dismiss active cell when clicking outside any cell or modal */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.cal-cell') && !target.closest('.cal-detail-modal')) {
      this.activeCell = null;
      this.selectedCell.set(null);
    }
  }

  // ── Cell display helpers ──────────────────────────────────────────────────

  cellColor(cell: DayCell): string {
    if (cell.color) return cell.color;
    return cell.status ? STATUS_META[cell.status].color : '';
  }

  cellBg(cell: DayCell): string {
    if (cell.color) return cell.color + '22'; // 13% opacity tint from the API color
    return cell.status ? STATUS_META[cell.status].bg : '';
  }

  cellTitle(cell: DayCell): string {
    const ds = cell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const label = cell.status ? STATUS_META[cell.status].label : 'No record';
    const holiday = cell.holidayName ? ` — ${cell.holidayName}` : '';
    const hrs = cell.hours !== undefined ? ` | ${this.formatHours(cell.hours)} worked` : '';
    return `${ds}${holiday} — ${label}${hrs}`;
  }

  /** Convert decimal hours to a friendly string: 1.49 → "1h 29m", 0.13 → "8m" */
  formatHours(h: number): string {
    const totalMins = Math.round(h * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  requiredHours(cell: DayCell): number {
    return cell.requiredHours;
  }

  /** Resolve required hours for a day: server-provided value wins, else the static present/half-day default. */
  private _requiredFor(status: AttendanceStatus | null, rec?: AttendanceRecord): number {
    if (rec?.requiredHours != null) return rec.requiredHours;
    return status ? (REQUIRED_HOURS[status] ?? 8) : 8;
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

  /** Circumference of the modal's hours-logged progress ring (r=24). */
  readonly ringCircumference = 2 * Math.PI * 24;

  /** stroke-dashoffset for the ring, given the cell's fill %. */
  ringOffset(cell: DayCell): number {
    return this.ringCircumference * (1 - this.fillPercent(cell) / 100);
  }

  /** How far short of the requirement the cell is, formatted (e.g. "1h 30m"). */
  shortfallLabel(cell: DayCell): string {
    if (cell.hours === undefined) return '';
    return this.formatHours(Math.max(0, this.requiredHours(cell) - cell.hours));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _ym() {
    const d = this.viewDate();
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  private _key(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private _dateKey(date: Date): string {
    return this._key(date.getFullYear(), date.getMonth(), date.getDate());
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

