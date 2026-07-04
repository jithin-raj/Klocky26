import {
  Component, Input, forwardRef, ChangeDetectionStrategy,
  ChangeDetectorRef, HostListener, HostBinding, ElementRef, signal, computed,
  OnDestroy, NgZone
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// ─────────────────────────────────────────────────────────────────────────────
// UiDatePickerComponent — accent-themed calendar popup, the date-picker
// counterpart to UiSelectComponent. Mirrors its API and visual language
// (trigger button, fixed-position panel, light/dark variants, CVA) so the
// two compose naturally in the same form. Value is a plain 'YYYY-MM-DD'
// string — the same shape every `<input type="date">` it replaces already
// produced, so swapping it in is a drop-in change at every call site.
// ─────────────────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date;
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'ui-datepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiDatePickerComponent),
    multi: true,
  }],
  template: `
    <div class="ui-field" [class.has-error]="error">
      @if (label) {
        <label class="ui-label">{{ label }}
          @if (required) { <span class="required">*</span> }
        </label>
      }

      <button
        type="button"
        class="ui-trigger"
        [class.open]="isOpen()"
        [class.placeholder]="!hasValue()"
        [class.disabled]="disabled"
        (click)="toggle()"
        [disabled]="disabled"
      >
        <svg class="ui-cal-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <span class="ui-trigger-text">{{ displayLabel() }}</span>
        <svg class="ui-chevron" [class.rotated]="isOpen()"
             width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="ui-panel" [class.upward]="openUpward()" [style]="panelStyle()">
          <div class="ui-cal-head">
            @if (pickerMode() === 'day') {
              <button type="button" class="ui-cal-nav" (click)="shiftMonth(-1)" aria-label="Previous month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="ui-cal-title ui-cal-title--btn" (click)="openYearPicker()" title="Pick year">
                {{ monthLabel() }} {{ viewYear() }}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <button type="button" class="ui-cal-nav" (click)="shiftMonth(1)" aria-label="Next month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            } @else if (pickerMode() === 'month') {
              <button type="button" class="ui-cal-nav" (click)="shiftViewYear(-1)" aria-label="Previous year">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="ui-cal-title ui-cal-title--btn" (click)="openYearPicker()" title="Pick year">
                {{ viewYear() }}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <button type="button" class="ui-cal-nav" (click)="shiftViewYear(1)" aria-label="Next year">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            } @else {
              <button type="button" class="ui-cal-nav" (click)="shiftYearPage(-1)" aria-label="Earlier years">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="ui-cal-title ui-cal-title--btn" (click)="pickerMode.set('day')">
                {{ yearPageStart() }} – {{ yearPageStart() + 11 }}
              </button>
              <button type="button" class="ui-cal-nav" (click)="shiftYearPage(1)" aria-label="Later years">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            }
          </div>

          @if (pickerMode() === 'day') {
            <div class="ui-cal-weekdays">
              @for (w of weekdayLabels; track w) { <span>{{ w }}</span> }
            </div>

            <div class="ui-cal-grid">
              @for (cell of monthGrid(); track cell.iso) {
                <button type="button" class="ui-cal-day"
                        [class.out-month]="!cell.inMonth"
                        [class.is-today]="cell.isToday"
                        [class.selected]="cell.iso === value"
                        [class.out-range]="isDateDisabled(cell.iso)"
                        [disabled]="isDateDisabled(cell.iso)"
                        (click)="select(cell.iso)">
                  {{ cell.day }}
                </button>
              }
            </div>

            <div class="ui-cal-footer">
              <button type="button" class="ui-cal-today" (click)="goToday()">Today</button>
              @if (hasValue()) {
                <button type="button" class="ui-cal-clear" (click)="clear()">Clear</button>
              }
            </div>
          } @else if (pickerMode() === 'month') {
            <div class="ui-month-grid">
              @for (m of monthShortLabels; track $index) {
                <button type="button" class="ui-month-btn"
                        [class.is-today-month]="$index === todayMonth && viewYear() === todayYear"
                        [class.selected]="$index === viewMonthIndex()"
                        (click)="selectMonth($index)">
                  {{ m }}
                </button>
              }
            </div>
          } @else {
            <div class="ui-year-grid">
              @for (y of yearPageList(); track y) {
                <button type="button" class="ui-year-btn"
                        [class.selected]="y === viewYear()"
                        [class.is-today-year]="y === todayYear"
                        (click)="selectYear(y)">
                  {{ y }}
                </button>
              }
            </div>
          }
        </div>
      }

      @if (hint && !error) { <span class="ui-hint">{{ hint }}</span> }
      @if (error) { <span class="ui-error">{{ error }}</span> }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .ui-field { display: flex; flex-direction: column; gap: 5px; }
    .ui-label { font-size: 13px; font-weight: 620; color: #374151; line-height: 1; }
    .required { color: #ef4444; margin-left: 2px; }

    .ui-trigger {
      display: flex; align-items: center; justify-content: flex-start;
      width: 100%; height: 42px; padding: 0 12px 0 14px;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 14px; font-family: inherit; color: #1e293b;
      cursor: pointer; text-align: left; outline: none; gap: 8px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .ui-trigger:hover:not(.disabled) { border-color: #c7d2e0; }
    .ui-trigger:focus-visible,
    .ui-trigger.open {
      border-color: var(--accent, #4f46e5);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #4f46e5) 12%, transparent);
    }
    .ui-trigger.placeholder .ui-trigger-text { color: #c8d5e8; }
    .ui-trigger.disabled { background: #f9fafb; opacity: .6; cursor: not-allowed; }
    .has-error .ui-trigger { border-color: #ef4444; }
    .ui-cal-icon { flex-shrink: 0; color: var(--accent, #4f46e5); }
    .ui-trigger-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ui-chevron { flex-shrink: 0; color: #94a3b8; transition: transform 0.18s ease; }
    .ui-chevron.rotated { transform: rotate(180deg); }

    .ui-panel {
      position: fixed; width: 264px;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px;
      box-shadow: 0 8px 30px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06);
      z-index: 9999; overflow: hidden; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
      animation: panel-in 0.14s cubic-bezier(0.16,1,0.3,1);
    }
    .ui-panel.upward { animation: panel-in-up 0.14s cubic-bezier(0.16,1,0.3,1); }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes panel-in-up {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ui-cal-head { display: flex; align-items: center; justify-content: space-between; }
    .ui-cal-title { font-size: 13.5px; font-weight: 700; color: #1e293b; }
    .ui-cal-title--btn {
      display: inline-flex; align-items: center; gap: 4px;
      border: none; background: none; cursor: pointer; font-size: 13.5px; font-weight: 700;
      color: #1e293b; padding: 3px 6px; border-radius: 7px; font-family: inherit;
      transition: background .12s, color .12s;
    }
    .ui-cal-title--btn:hover { background: color-mix(in srgb, var(--accent, #4f46e5) 10%, transparent); color: var(--accent, #4f46e5); }
    .ui-year-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
      padding: 4px 0;
    }
    .ui-year-btn {
      display: flex; align-items: center; justify-content: center;
      height: 34px; border: none; background: none; border-radius: 8px;
      font-size: 13px; color: #1e293b; cursor: pointer; font-family: inherit;
      transition: background .12s, color .12s;
    }
    .ui-year-btn:hover { background: #f1f5f9; }
    .ui-year-btn.is-today-year { font-weight: 700; color: var(--accent, #4f46e5); }
    .ui-year-btn.selected {
      background: var(--accent, #4f46e5); color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px -1px color-mix(in srgb, var(--accent, #4f46e5) 60%, transparent);
    }
    .ui-month-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
      padding: 4px 0;
    }
    .ui-month-btn {
      display: flex; align-items: center; justify-content: center;
      height: 36px; border: none; background: none; border-radius: 8px;
      font-size: 13px; color: #1e293b; cursor: pointer; font-family: inherit;
      transition: background .12s, color .12s;
    }
    .ui-month-btn:hover { background: #f1f5f9; }
    .ui-month-btn.is-today-month { font-weight: 700; color: var(--accent, #4f46e5); }
    .ui-month-btn.selected {
      background: var(--accent, #4f46e5); color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px -1px color-mix(in srgb, var(--accent, #4f46e5) 60%, transparent);
    }
    .ui-cal-nav {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 8px; border: none;
      background: #f8fafc; color: #475569; cursor: pointer; transition: background .15s, color .15s;
    }
    .ui-cal-nav:hover { background: color-mix(in srgb, var(--accent, #4f46e5) 12%, transparent); color: var(--accent, #4f46e5); }

    .ui-cal-weekdays {
      display: grid; grid-template-columns: repeat(7, 1fr);
      font-size: 10.5px; font-weight: 700; color: #94a3b8; text-align: center;
      letter-spacing: .03em; text-transform: uppercase;
    }

    .ui-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .ui-cal-day {
      display: flex; align-items: center; justify-content: center;
      height: 30px; border: none; background: none; border-radius: 8px;
      font-size: 13px; color: #1e293b; cursor: pointer; transition: background .12s, color .12s;
    }
    .ui-cal-day:hover { background: #f1f5f9; }
    .ui-cal-day.out-month { color: #cbd5e1; }
    .ui-cal-day.out-range { color: #e2e8f0; cursor: not-allowed; pointer-events: none; }
    .ui-cal-day.out-range:hover { background: none; }
    .ui-cal-day.is-today { font-weight: 700; color: var(--accent, #4f46e5); }
    .ui-cal-day.selected {
      background: var(--accent, #4f46e5); color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px -1px color-mix(in srgb, var(--accent, #4f46e5) 60%, transparent);
    }
    .ui-cal-day.selected:hover { background: var(--accent, #4f46e5); }

    .ui-cal-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 8px; border-top: 1px solid #f1f5f9;
    }
    .ui-cal-today, .ui-cal-clear {
      border: none; background: none; cursor: pointer;
      font-size: 12px; font-weight: 600; padding: 4px 6px; border-radius: 6px;
    }
    .ui-cal-today { color: var(--accent, #4f46e5); }
    .ui-cal-today:hover { background: color-mix(in srgb, var(--accent, #4f46e5) 10%, transparent); }
    .ui-cal-clear { color: #94a3b8; }
    .ui-cal-clear:hover { background: #f1f5f9; color: #64748b; }

    .ui-hint  { font-size: 12px; color: #6b7280; }
    .ui-error { font-size: 12px; color: #ef4444; }

    /* ── Dark theme ──────────────────────────────────────────── */
    :host(.dark) .ui-label {
      font-size: 12px; font-weight: 600; color: rgba(255,255,255,.45);
      text-transform: uppercase; letter-spacing: .7px;
    }
    :host(.dark) .ui-trigger {
      background: rgba(255,255,255,.06);
      border: 1.5px solid rgba(255,255,255,.1);
      border-radius: 12px;
      height: 52px; padding: 0 14px;
      color: rgba(255,255,255,.88); font-size: 15px;
    }
    :host(.dark) .ui-trigger:hover:not(.disabled) {
      border-color: rgba(255,255,255,.2);
      background: rgba(255,255,255,.08);
    }
    :host(.dark) .ui-trigger.placeholder .ui-trigger-text { color: rgba(255,255,255,.25); }
    :host(.dark) .ui-trigger.disabled { background: rgba(255,255,255,.04); opacity: .4; }
    :host(.dark) .ui-chevron { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-panel {
      background: #161623;
      border: 1.5px solid rgba(255,255,255,.1);
      box-shadow: 0 16px 48px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4);
    }
    :host(.dark) .ui-cal-title { color: rgba(255,255,255,.88); }
    :host(.dark) .ui-cal-nav { background: rgba(255,255,255,.06); color: rgba(255,255,255,.6); }
    :host(.dark) .ui-cal-weekdays { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-cal-day { color: rgba(255,255,255,.8); }
    :host(.dark) .ui-cal-day:hover { background: rgba(255,255,255,.08); }
    :host(.dark) .ui-cal-day.out-month { color: rgba(255,255,255,.18); }
    :host(.dark) .ui-cal-footer { border-top-color: rgba(255,255,255,.08); }
    :host(.dark) .ui-cal-clear { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-cal-clear:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.6); }
    :host(.dark) .ui-hint  { color: rgba(255,255,255,.28); }
    :host(.dark) .ui-error { color: #f87171; }
    :host(.dark) .has-error .ui-trigger { border-color: rgba(239,68,68,.6); box-shadow: 0 0 0 4px rgba(239,68,68,.1); }
  `],
})
export class UiDatePickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = '';
  @Input() placeholder = 'Select date';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() dark = false;
  /** ISO date string (yyyy-MM-dd) — dates before this are disabled */
  @Input() minDate = '';
  /** ISO date string (yyyy-MM-dd) — dates after this are disabled */
  @Input() maxDate = '';

  @HostBinding('class.dark') get isDark() { return this.dark; }

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly monthShortLabels = MONTH_SHORT;

  value: string = '';
  isOpen = signal(false);
  openUpward = signal(false);
  panelStyle = signal<Record<string, string>>({});
  pickerMode = signal<'day' | 'month' | 'year'>('day');

  readonly todayYear  = new Date().getFullYear();
  readonly todayMonth = new Date().getMonth();
  private readonly _yearPageBase = signal(Math.floor(new Date().getFullYear() / 12) * 12);

  readonly yearPageStart  = computed(() => this._yearPageBase());
  readonly yearPageList   = computed(() =>
    Array.from({ length: 12 }, (_, i) => this._yearPageBase() + i)
  );

  private readonly _viewDate = signal<Date>(new Date());
  viewYear       = computed(() => this._viewDate().getFullYear());
  viewMonthIndex = computed(() => this._viewDate().getMonth());
  monthLabel     = computed(() => MONTH_LABELS[this._viewDate().getMonth()]);

  monthGrid = computed<DayCell[]>(() => {
    const view = this._viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun
    const gridStart = new Date(year, month, 1 - startOffset);
    const today = toIso(new Date());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toIso(d);
      return {
        date: d,
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: iso === today,
      };
    });
  });

  onChange = (_: any) => {};
  onTouched = () => {};

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef, private zone: NgZone) {
    this._scrollHandler = (e: Event) => {
      if (!this.isOpen()) return;
      const target = e.target as Node;
      if (this.el.nativeElement.contains(target)) return;
      if (target instanceof Element && target.closest('.ui-panel')) return;
      this.zone.run(() => this.close());
    };
    this._resizeHandler = () => {
      if (this.isOpen()) this.computePosition();
    };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('scroll', this._scrollHandler, { capture: true, passive: true });
      window.addEventListener('resize', this._resizeHandler, { passive: true });
    });
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this._scrollHandler, { capture: true });
    window.removeEventListener('resize', this._resizeHandler);
  }

  private _scrollHandler: (e: Event) => void;
  private _resizeHandler: () => void;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close();
  }

  toggle() {
    if (this.disabled) return;
    this.isOpen() ? this.close() : this.open();
  }

  private open() {
    this._viewDate.set(parseIso(this.value) ?? new Date());
    this.computePosition();
    this.isOpen.set(true);
    this.cdr.markForCheck();
  }

  private close() {
    this.isOpen.set(false);
    this.pickerMode.set('day');
    this.cdr.markForCheck();
  }

  private computePosition() {
    const rect: DOMRect = this.el.nativeElement.getBoundingClientRect();
    const gap = 4;
    const panelHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const goUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    this.openUpward.set(goUp);
    const panelWidth = 280;
    const clampedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
    const style: Record<string, string> = {
      position: 'fixed',
      left: clampedLeft + 'px',
      'z-index': '9999',
    };
    if (goUp) {
      style['bottom'] = (window.innerHeight - rect.top + gap) + 'px';
    } else {
      style['top'] = (rect.bottom + gap) + 'px';
    }
    this.panelStyle.set(style);
  }

  shiftMonth(delta: number) {
    const d = this._viewDate();
    this._viewDate.set(new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  openYearPicker() {
    const base = Math.floor(this.viewYear() / 12) * 12;
    this._yearPageBase.set(base);
    this.pickerMode.set('year');
  }

  closeYearPicker() {
    this.pickerMode.set('day');
  }

  shiftYearPage(delta: number) {
    this._yearPageBase.update(b => b + delta * 12);
  }

  shiftViewYear(delta: number) {
    const d = this._viewDate();
    this._viewDate.set(new Date(d.getFullYear() + delta, d.getMonth(), 1));
  }

  selectYear(year: number) {
    const d = this._viewDate();
    this._viewDate.set(new Date(year, d.getMonth(), 1));
    this.pickerMode.set('month');
  }

  selectMonth(monthIndex: number) {
    const d = this._viewDate();
    this._viewDate.set(new Date(d.getFullYear(), monthIndex, 1));
    this.pickerMode.set('day');
  }

  goToday() {
    this._viewDate.set(new Date());
    this.pickerMode.set('day');
  }

  isDateDisabled(iso: string): boolean {
    if (this.minDate && iso < this.minDate) return true;
    if (this.maxDate && iso > this.maxDate) return true;
    return false;
  }

  select(iso: string) {
    if (this.isDateDisabled(iso)) return;
    this.value = iso;
    this.onChange(iso);
    this.onTouched();
    this.close();
  }

  clear() {
    this.value = '';
    this.onChange('');
    this.onTouched();
    this.close();
  }

  hasValue(): boolean {
    return !!this.value;
  }

  displayLabel(): string {
    const d = parseIso(this.value);
    if (!d) return this.placeholder;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  writeValue(val: string) { this.value = val ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; this.cdr.markForCheck(); }
}
