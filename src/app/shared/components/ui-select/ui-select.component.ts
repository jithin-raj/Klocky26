import {
  Component, Input, forwardRef, ChangeDetectionStrategy,
  ChangeDetectorRef, HostListener, HostBinding, ElementRef, signal, computed,
  OnDestroy, NgZone
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormsModule } from '@angular/forms';

export type SelectOption = string | { label: string; value: any };

@Component({
  selector: 'ui-select',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiSelectComponent),
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
        <span class="ui-trigger-text">{{ displayLabel() }}</span>
        <svg class="ui-chevron" [class.rotated]="isOpen()"
             width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="ui-panel"
             [class.upward]="openUpward()"
             [style]="panelStyle()">

          @if (searchable) {
            <div class="ui-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                class="ui-search"
                type="text"
                placeholder="Search..."
                autocomplete="off"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                (click)="$event.stopPropagation()"
              />
              @if (searchQuery()) {
                <button type="button" class="ui-search-clear" (click)="searchQuery.set(''); $event.stopPropagation()">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              }
            </div>
          }

          @if (placeholder && !searchQuery()) {
            <button type="button" class="ui-option ui-option-placeholder"
                    [class.selected]="!hasValue()"
                    (click)="select('')">
              {{ placeholder }}
            </button>
          }

          <div class="ui-options-list">
          @for (o of filteredOptions(); track optionValue(o)) {
            <button type="button" class="ui-option"
                    [class.selected]="hasValue() && value === optionValue(o)"
                    (click)="select(optionValue(o))">
              <span class="ui-option-label">{{ optionLabel(o) }}</span>
              @if (hasValue() && value === optionValue(o)) {
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.8"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </button>
          }

          @if (filteredOptions().length === 0) {
            <div class="ui-no-results">No results for "{{ searchQuery() }}"</div>
          }
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
      display: flex; align-items: center; justify-content: space-between;
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
    .ui-trigger-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ui-chevron { flex-shrink: 0; color: #94a3b8; transition: transform 0.18s ease; }
    .ui-chevron.rotated { transform: rotate(180deg); }

    .ui-panel {
      position: fixed;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 8px 30px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06);
      z-index: 9999; overflow: hidden; max-height: 300px;
      display: flex; flex-direction: column;
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

    /* Search box */
    .ui-search-wrap {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1.5px solid #f1f5f9;
      flex-shrink: 0;
    }
    .ui-search-wrap svg { color: #94a3b8; flex-shrink: 0; }
    .ui-search {
      flex: 1; border: none; outline: none; font-size: 13.5px;
      font-family: inherit; color: #1e293b; background: transparent;
      min-width: 0;
    }
    .ui-search::placeholder { color: #c8d5e8; }
    .ui-search-clear {
      border: none; background: none; cursor: pointer; padding: 2px;
      color: #94a3b8; display: flex; align-items: center;
      border-radius: 4px;
    }
    .ui-search-clear:hover { color: #64748b; background: #f1f5f9; }

    /* Options list */
    .ui-options-list { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }

    .ui-option {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: 10px 14px; border: none; background: none;
      font-size: 13.5px; color: #1e293b; font-family: inherit;
      cursor: pointer; text-align: left; transition: background 0.1s; gap: 8px;
    }
    .ui-option:not(:last-child) { border-bottom: 1px solid #f8fafc; }
    .ui-option:hover { background: #f8fafc; }
    .ui-option.selected {
      background: color-mix(in srgb, var(--accent, #4f46e5) 8%, transparent);
      color: var(--accent, #4f46e5); font-weight: 600;
    }
    .ui-option.selected svg { color: var(--accent, #4f46e5); flex-shrink: 0; }
    .ui-option-placeholder { color: #94a3b8; font-style: italic; border-bottom: 1px solid #f1f5f9 !important; }
    .ui-option-placeholder.selected { background: #f8fafc; color: #94a3b8; font-weight: 400; }
    .ui-option-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ui-no-results {
      padding: 16px 14px; text-align: center;
      font-size: 13px; color: #94a3b8; font-style: italic;
    }

    .ui-hint  { font-size: 12px; color: #6b7280; }
    .ui-error { font-size: 12px; color: #ef4444; }

    /* ── Dark theme ──────────────────────────────────────────── */
    :host(.dark) .ui-label {
      font-size: 12px; font-weight: 600; color: rgba(255,255,255,.45);
      text-transform: uppercase; letter-spacing: .7px;
    }
    :host(.dark) .required { color: rgba(248,113,113,.8); }

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
    :host(.dark) .ui-trigger:focus-visible,
    :host(.dark) .ui-trigger.open {
      border-color: rgb(var(--th-ar) var(--th-ag) var(--th-ab) / .65);
      background: rgb(var(--th-ar) var(--th-ag) var(--th-ab) / .06);
      box-shadow: 0 0 0 4px rgb(var(--th-ar) var(--th-ag) var(--th-ab) / .12);
    }
    :host(.dark) .ui-trigger.placeholder .ui-trigger-text { color: rgba(255,255,255,.25); }
    :host(.dark) .ui-trigger.disabled { background: rgba(255,255,255,.04); opacity: .4; }
    :host(.dark) .ui-chevron { color: rgba(255,255,255,.3); }

    :host(.dark) .ui-panel {
      background: #161623;
      border: 1.5px solid rgba(255,255,255,.1);
      box-shadow: 0 16px 48px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4);
    }
    :host(.dark) .ui-search-wrap {
      border-bottom-color: rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }
    :host(.dark) .ui-search-wrap svg { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-search { color: rgba(255,255,255,.88); }
    :host(.dark) .ui-search::placeholder { color: rgba(255,255,255,.2); }
    :host(.dark) .ui-search-clear { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-search-clear:hover { color: rgba(255,255,255,.6); background: rgba(255,255,255,.06); }
    :host(.dark) .ui-options-list { scrollbar-color: rgb(var(--th-ar) var(--th-ag) var(--th-ab) / .4) transparent; }
    :host(.dark) .ui-option {
      color: rgba(255,255,255,.8); font-size: 14px;
      border-bottom-color: rgba(255,255,255,.05);
    }
    :host(.dark) .ui-option:not(:last-child) { border-bottom-color: rgba(255,255,255,.05); }
    :host(.dark) .ui-option:hover { background: rgba(255,255,255,.06); }
    :host(.dark) .ui-option.selected {
      background: rgb(var(--th-ar) var(--th-ag) var(--th-ab) / .15);
      color: var(--th-text-accent); font-weight: 600;
    }
    :host(.dark) .ui-option.selected svg { color: var(--th-text-accent); }
    :host(.dark) .ui-option-placeholder { color: rgba(255,255,255,.25); }
    :host(.dark) .ui-no-results { color: rgba(255,255,255,.3); }
    :host(.dark) .ui-hint  { color: rgba(255,255,255,.28); }
    :host(.dark) .ui-error { color: #f87171; }
    :host(.dark) .has-error .ui-trigger { border-color: rgba(239,68,68,.6); box-shadow: 0 0 0 4px rgba(239,68,68,.1); }
  `],
})
export class UiSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = '';
  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() name = '';
  @Input() searchable = false;
  @Input() dark = false;

  @HostBinding('class.dark') get isDark() { return this.dark; }

  value: any = '';
  isOpen = signal(false);
  openUpward = signal(false);
  searchQuery = signal('');

  // Panel fixed position state
  private _panelTop    = 0;
  private _panelBottom = 0;
  private _panelLeft   = 0;
  private _panelWidth  = 0;

  panelStyle = signal<Record<string, string>>({});

  onChange = (_: any) => {};
  onTouched = () => {};

  filteredOptions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.options;
    return this.options.filter(o =>
      this.optionLabel(o).toLowerCase().includes(q)
    );
  });

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef, private zone: NgZone) {
    // Close on scroll only when the scroll happens OUTSIDE the panel itself.
    this._scrollHandler = (e: Event) => {
      if (!this.isOpen()) return;
      const target = e.target as Node;
      // If the scroll originated inside the host element (options list, search box), ignore it.
      if (this.el.nativeElement.contains(target)) return;
      // Also ignore scroll events on the fixed panel element (matched by class).
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
    if (!this.el.nativeElement.contains(e.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close();
  }

  toggle() {
    if (this.disabled) return;
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  private open() {
    this.searchQuery.set('');
    this.computePosition();
    this.isOpen.set(true);
    this.cdr.markForCheck();
  }

  private close() {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.cdr.markForCheck();
  }

  private computePosition() {
    const rect: DOMRect = this.el.nativeElement.getBoundingClientRect();
    const gap = 4;
    const panelHeight = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const goUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    this.openUpward.set(goUp);
    this._panelLeft  = rect.left;
    this._panelWidth = rect.width;
    this._panelTop   = rect.bottom + gap;
    this._panelBottom = window.innerHeight - rect.top + gap;

    const style: Record<string, string> = {
      position: 'fixed',
      left: this._panelLeft + 'px',
      width: this._panelWidth + 'px',
      'z-index': '9999',
    };
    if (goUp) {
      style['bottom'] = this._panelBottom + 'px';
    } else {
      style['top'] = this._panelTop + 'px';
    }
    this.panelStyle.set(style);
  }

  select(val: any) {
    this.value = val;
    this.onChange(val);
    this.onTouched();
    this.close();
  }

  hasValue(): boolean {
    return this.value !== '' && this.value !== null && this.value !== undefined;
  }

  displayLabel(): string {
    if (!this.hasValue()) return this.placeholder || 'Select...';
    const match = this.options.find(o => this.optionValue(o) === this.value);
    return match ? this.optionLabel(match) : String(this.value);
  }

  writeValue(val: any) { this.value = val ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; this.cdr.markForCheck(); }

  optionValue(o: SelectOption): any {
    return typeof o === 'string' ? o : o.value;
  }
  optionLabel(o: SelectOption): string {
    return typeof o === 'string' ? o : o.label;
  }
}
