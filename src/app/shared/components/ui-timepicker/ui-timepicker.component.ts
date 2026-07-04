import {
  Component, Input, forwardRef, ChangeDetectionStrategy,
  ChangeDetectorRef, HostListener, ElementRef, signal,
  OnDestroy, NgZone
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00 05 10 … 55

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

@Component({
  selector: 'ui-timepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiTimePickerComponent),
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
        [class.placeholder]="!value"
        [class.disabled]="disabled"
        (click)="toggle()"
        [disabled]="disabled"
      >
        <svg class="ui-clock-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="ui-trigger-text">{{ value || placeholder }}</span>
        <svg class="ui-chevron" [class.rotated]="isOpen()"
             width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="ui-tp-panel" [style]="panelStyle()">
          <div class="ui-tp-header">
            <span class="ui-tp-cur">{{ pad2(selectedHour()) }}<span class="ui-tp-colon">:</span>{{ pad2(selectedMinute()) }}</span>
          </div>
          <div class="ui-tp-body">
            <div class="ui-tp-section">
              <div class="ui-tp-col-label">HH</div>
              <div class="ui-tp-col ui-tp-hours">
                @for (h of hours; track h) {
                  <button type="button" class="ui-tp-cell"
                          [class.selected]="selectedHour() === h"
                          (click)="pickHour(h)">
                    {{ pad2(h) }}
                  </button>
                }
              </div>
            </div>

            <div class="ui-tp-div">:</div>

            <div class="ui-tp-section">
              <div class="ui-tp-col-label">MM</div>
              <div class="ui-tp-col ui-tp-mins">
                @for (m of minutes; track m) {
                  <button type="button" class="ui-tp-cell"
                          [class.selected]="selectedMinute() === m"
                          (click)="pickMinute(m)">
                    {{ pad2(m) }}
                  </button>
                }
              </div>
            </div>
          </div>
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
      display: flex; align-items: center;
      width: 100%; height: 42px; padding: 0 12px 0 14px;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 14px; font-family: inherit; color: #1e293b;
      cursor: pointer; text-align: left; outline: none; gap: 8px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .ui-trigger:hover:not(.disabled) { border-color: #c7d2e0; }
    .ui-trigger.open,
    .ui-trigger:focus-visible {
      border-color: var(--accent, #4f46e5);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #4f46e5) 12%, transparent);
    }
    .ui-trigger.placeholder .ui-trigger-text { color: #c8d5e8; }
    .ui-trigger.disabled { background: #f9fafb; opacity: .6; cursor: not-allowed; }
    .has-error .ui-trigger { border-color: #ef4444; }

    .ui-clock-icon { flex-shrink: 0; color: var(--accent, #4f46e5); }
    .ui-trigger-text { flex: 1; font-variant-numeric: tabular-nums; font-weight: 500; }
    .ui-chevron { flex-shrink: 0; color: #94a3b8; transition: transform 0.18s ease; }
    .ui-chevron.rotated { transform: rotate(180deg); }

    /* ── Panel ── */
    .ui-tp-panel {
      position: fixed; width: 200px;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(15,23,42,0.13), 0 2px 8px rgba(15,23,42,0.06);
      z-index: 9999; overflow: hidden;
      animation: tp-in 0.14s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes tp-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ui-tp-header {
      display: flex; align-items: center; justify-content: center;
      padding: 11px 0 9px;
      background: color-mix(in srgb, var(--accent, #4f46e5) 6%, #fff);
      border-bottom: 1.5px solid color-mix(in srgb, var(--accent, #4f46e5) 12%, #e2e8f0);
    }
    .ui-tp-cur {
      font-size: 20px; font-weight: 800; color: var(--accent, #4f46e5);
      font-variant-numeric: tabular-nums; letter-spacing: .04em;
    }
    .ui-tp-colon { opacity: 0.55; }

    /* ── Column labels + columns ── */
    .ui-tp-body {
      display: flex;
      height: 196px;
    }
    .ui-tp-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .ui-tp-col-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      color: #94a3b8; text-align: center;
      padding: 6px 0 3px; letter-spacing: .06em;
      flex-shrink: 0;
    }
    .ui-tp-col {
      flex: 1;
      overflow-y: auto; padding: 4px 5px;
      display: flex; flex-direction: column; gap: 1px;
      scrollbar-width: none;
    }
    .ui-tp-col::-webkit-scrollbar { display: none; }
    .ui-tp-div {
      width: 20px; flex-shrink: 0;
      display: flex; align-items: flex-start; justify-content: center;
      font-size: 17px; font-weight: 700; color: #cbd5e1;
      padding-top: 28px;
    }

    .ui-tp-cell {
      display: flex; align-items: center; justify-content: center;
      height: 30px; min-height: 30px; flex-shrink: 0;
      border: none; background: none; border-radius: 7px;
      font-size: 13.5px; color: #1e293b; cursor: pointer;
      font-family: inherit; font-variant-numeric: tabular-nums;
      transition: background .1s, color .1s;
    }
    .ui-tp-cell:hover { background: #f1f5f9; }
    .ui-tp-cell.selected {
      background: var(--accent, #4f46e5); color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px -1px color-mix(in srgb, var(--accent, #4f46e5) 50%, transparent);
    }
    .ui-tp-cell.selected:hover { background: var(--accent, #4f46e5); }

    .ui-hint  { font-size: 12px; color: #6b7280; }
    .ui-error { font-size: 12px; color: #ef4444; }
  `],
})
export class UiTimePickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = '';
  @Input() placeholder = '--:--';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;

  value = '';
  isOpen    = signal(false);
  panelStyle = signal<Record<string, string>>({});
  selectedHour   = signal(9);
  selectedMinute = signal(0);

  readonly hours   = HOURS;
  readonly minutes = MINUTES;
  readonly pad2    = pad2;

  onChange  = (_: any) => {};
  onTouched = () => {};

  private _scrollHandler: (e: Event) => void;
  private _resizeHandler: () => void;

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef, private zone: NgZone) {
    this._scrollHandler = (e: Event) => {
      if (!this.isOpen()) return;
      const target = e.target as Node;
      if (this.el.nativeElement.contains(target)) return;
      if (target instanceof Element && target.closest('.ui-tp-panel')) return;
      this.zone.run(() => this.close());
    };
    this._resizeHandler = () => {
      if (this.isOpen()) this._computePosition();
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
    const parts = this.value ? this.value.split(':') : [];
    const h = parts[0] ? Number(parts[0]) : 9;
    const rawM = parts[1] ? Number(parts[1]) : 0;
    this.selectedHour.set(isNaN(h) ? 9 : h);
    this.selectedMinute.set(Math.round((isNaN(rawM) ? 0 : rawM) / 5) * 5 % 60);
    this._computePosition();
    this.isOpen.set(true);
    this.cdr.markForCheck();
    setTimeout(() => this._scrollSelected(), 60);
  }

  private close() {
    this.isOpen.set(false);
    this.cdr.markForCheck();
  }

  private _computePosition() {
    const rect: DOMRect = this.el.nativeElement.getBoundingClientRect();
    const gap = 4;
    const panelH = 260;
    const goUp = (window.innerHeight - rect.bottom) < panelH && rect.top > panelH;
    const style: Record<string, string> = {
      position: 'fixed',
      left: rect.left + 'px',
      'z-index': '9999',
    };
    if (goUp) {
      style['bottom'] = (window.innerHeight - rect.top + gap) + 'px';
    } else {
      style['top'] = (rect.bottom + gap) + 'px';
    }
    this.panelStyle.set(style);
  }

  private _scrollSelected() {
    const panel = document.querySelector('.ui-tp-panel');
    if (!panel) return;
    panel.querySelectorAll('.ui-tp-col').forEach(col => {
      const sel = col.querySelector('.selected');
      if (sel) sel.scrollIntoView({ block: 'center' });
    });
  }

  pickHour(h: number) {
    this.selectedHour.set(h);
    this._emit();
  }

  pickMinute(m: number) {
    this.selectedMinute.set(m);
    this._emit();
    this.close();
  }

  private _emit() {
    const val = `${pad2(this.selectedHour())}:${pad2(this.selectedMinute())}`;
    this.value = val;
    this.onChange(val);
    this.onTouched();
    this.cdr.markForCheck();
  }

  writeValue(val: string)            { this.value = val ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: any)          { this.onChange = fn; }
  registerOnTouched(fn: any)         { this.onTouched = fn; }
  setDisabledState(d: boolean)       { this.disabled = d; this.cdr.markForCheck(); }
}
