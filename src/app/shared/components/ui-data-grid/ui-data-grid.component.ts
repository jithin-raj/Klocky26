import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef, HostListener, HostBinding, ElementRef, signal, NgZone, OnDestroy,
  ContentChildren, QueryList, TemplateRef, Directive, Input as DirectiveInput,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Marks an <ng-template> projected into <ui-data-grid> as the renderer for a
 * 'custom' typed column. Usage:
 *   <ng-template gridColumn="actions" let-row>...</ng-template>
 */
@Directive({
  selector: 'ng-template[gridColumn]',
  standalone: true,
})
export class GridColumnTemplateDirective {
  @DirectiveInput('gridColumn') columnKey = '';
  constructor(public templateRef: TemplateRef<{ $implicit: any; row: any }>) {}
}

export type GridColumnType = 'text' | 'badge' | 'date' | 'avatar' | 'text-pair' | 'custom';

export interface GridColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  type?: GridColumnType;
  /** For type 'text'/'date'/'badge': how to read the cell value off the row. Defaults to row[key]. */
  value?: (row: T) => any;
  /** For type 'date': a date format string (Angular DatePipe format), default 'MMM d, yyyy'. */
  dateFormat?: string;
  /** For type 'badge': maps the cell value to a CSS class suffix and/or label override. */
  badgeClass?: (value: any, row: T) => string;
  badgeLabel?: (value: any, row: T) => string;
  /** For type 'badge': optional direct background/text color override (bypasses badgeClass theming). */
  badgeBg?: (value: any, row: T) => string;
  badgeColor?: (value: any, row: T) => string;
  /** For type 'avatar': render an initials avatar + a primary/secondary text line beside it. */
  avatarInitials?: (row: T) => string;
  avatarColor?: (row: T) => string;
  /** For type 'avatar' or 'text-pair': primary/secondary lines of text. */
  primaryText?: (row: T) => string;
  secondaryText?: (row: T) => string;
  /** For type 'avatar': an optional third, smaller line (e.g. employee code). */
  tertiaryText?: (row: T) => string;
}

export interface GridAction<T> {
  label: string;
  icon?: string;
  danger?: boolean;
  visible?: (row: T) => boolean;
  click: (row: T) => void;
}

export type SortDirection = 'asc' | 'desc';

let _gridSeq = 0;

@Component({
  selector: 'ui-data-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dg-wrap">
      <table class="dg-table">
        <thead>
          <tr>
            @if (selectable) {
              <th class="dg-th dg-th--check">
                <input type="checkbox" [checked]="allSelected" (change)="onToggleSelectAll()" />
              </th>
            }
            @for (col of columns; track col.key) {
              <th
                class="dg-th"
                [class.dg-th--sortable]="col.sortable"
                [style.width]="col.width"
                (click)="col.sortable && onSort(col.key)"
              >
                {{ col.label }}
                @if (col.sortable) {
                  <span class="dg-sort-icon dg-sort-icon--{{ sortIconFor(col.key) }}"></span>
                }
              </th>
            }
            @if (actions.length) {
              <th class="dg-th dg-th--actions"></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track trackBy(row)) {
            <tr
              class="dg-row"
              [class.dg-row--selected]="selectable && selectedIds.has(trackBy(row))"
              (click)="onRowClick(row)"
            >
              @if (selectable) {
                <td class="dg-td dg-td--check" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="selectedIds.has(trackBy(row))"
                    (change)="onToggleRow(row)"
                  />
                </td>
              }
              @for (col of columns; track col.key) {
                <td class="dg-td" [class.dg-td--avatar]="col.type === 'avatar'">
                  @switch (col.type) {
                    @case ('avatar') {
                      <div class="dg-avatar" [style.background]="col.avatarColor ? col.avatarColor(row) : null">
                        {{ col.avatarInitials ? col.avatarInitials(row) : '' }}
                      </div>
                      <div class="dg-person-info">
                        <span class="dg-person-name">{{ col.primaryText ? col.primaryText(row) : '' }}</span>
                        @if (col.secondaryText) {
                          <span class="dg-person-sub">{{ col.secondaryText(row) }}</span>
                        }
                        @if (col.tertiaryText) {
                          <span class="dg-person-code">{{ col.tertiaryText(row) }}</span>
                        }
                      </div>
                    }
                    @case ('text-pair') {
                      <div class="dg-cell-primary">{{ col.primaryText ? col.primaryText(row) : '' }}</div>
                      @if (col.secondaryText) {
                        <div class="dg-cell-sub">{{ col.secondaryText(row) }}</div>
                      }
                    }
                    @case ('badge') {
                      <span
                        class="dg-badge dg-badge--{{ badgeClassFor(col, row) }}"
                        [style.background]="col.badgeBg ? col.badgeBg(cellValue(col, row), row) : null"
                        [style.color]="col.badgeColor ? col.badgeColor(cellValue(col, row), row) : null"
                      >{{ badgeLabelFor(col, row) }}</span>
                    }
                    @case ('date') {
                      {{ cellValue(col, row) | date:(col.dateFormat || 'MMM d, yyyy') }}
                    }
                    @case ('custom') {
                      <ng-container
                        [ngTemplateOutlet]="templateFor(col.key) ?? null"
                        [ngTemplateOutletContext]="{ $implicit: row, row: row }"
                      ></ng-container>
                    }
                    @default {
                      {{ cellValue(col, row) }}
                    }
                  }
                </td>
              }
              @if (actions.length) {
                <td class="dg-td dg-td--actions" (click)="$event.stopPropagation()">
                  <div class="dg-action-menu">
                    <button
                      class="dg-action-btn"
                      type="button"
                      (click)="toggleActionMenu(trackBy(row), row, $event)"
                    >⋯</button>
                  </div>
                </td>
              }
            </tr>
          }
          @if (!loading && rows.length === 0) {
            <tr>
              <td class="dg-empty" [attr.colspan]="totalColumns">
                <div class="dg-empty-inner">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>{{ emptyMessage }}</p>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (openMenuId() !== null) {
      <div class="dg-action-dropdown" [style]="menuStyle()">
        @for (action of normalActions(); track action.label) {
          <button type="button" (click)="runAction(action, $event)">
            @if (action.icon) { <span class="dg-action-ic" [innerHTML]="action.icon"></span> }
            <span>{{ action.label }}</span>
          </button>
        }
        @if (normalActions().length && dangerActions().length) {
          <div class="dg-action-sep"></div>
        }
        @for (action of dangerActions(); track action.label) {
          <button type="button" class="danger" (click)="runAction(action, $event)">
            @if (action.icon) { <span class="dg-action-ic" [innerHTML]="action.icon"></span> }
            <span>{{ action.label }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .dg-wrap {
      overflow-x: auto;
      border-radius: 12px;
      border: 1.5px solid #e5e7eb;
      background: #fff;
    }

    .dg-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }

    .dg-th {
      padding: 11px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #f8fafc;
      border-bottom: 1.5px solid #e5e7eb;
      white-space: nowrap;
    }
    .dg-th--check { width: 40px; }
    .dg-th--actions { width: 50px; }
    .dg-th--sortable { cursor: pointer; user-select: none; }
    .dg-th--sortable:hover { color: #334155; }

    .dg-sort-icon {
      display: inline-block;
      width: 12px;
      text-align: center;
      font-style: normal;
      color: #94a3b8;
    }
    .dg-sort-icon::after { content: '↕'; }
    .dg-sort-icon--asc::after { content: '↑'; color: var(--accent, #6366f1); }
    .dg-sort-icon--desc::after { content: '↓'; color: var(--accent, #6366f1); }

    .dg-row { transition: background 0.1s; cursor: default; }
    .dg-row:hover { background: #f8fafc; }
    .dg-row--selected { background: color-mix(in srgb, var(--accent, #6366f1) 5%, #fff); }

    .dg-td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
      color: #334155;
    }
    .dg-td--check { width: 40px; }
    .dg-td--actions { width: 50px; }
    .dg-td--avatar { display: flex; align-items: center; gap: 10px; min-width: 220px; }

    .dg-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12.5px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      background: #6366f1;
    }

    .dg-person-info { display: flex; flex-direction: column; gap: 1px; }
    .dg-person-name { font-weight: 600; color: #1e293b; font-size: 13.5px; }
    .dg-person-sub { font-size: 12px; color: #64748b; }
    .dg-person-code { font-size: 11px; color: #94a3b8; font-family: monospace; }

    .dg-cell-primary { font-weight: 500; color: #1e293b; }
    .dg-cell-sub { font-size: 12px; color: #64748b; }

    .dg-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
    }

    .dg-action-menu { position: relative; display: flex; }

    .dg-action-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #94a3b8;
      padding: 4px 8px;
      border-radius: 6px;
      line-height: 1;
    }
    .dg-action-btn:hover { background: #f1f5f9; color: #334155; }

    /* Fixed-positioned dropdown — computed via getBoundingClientRect so it can
       never be clipped by an ancestor's overflow:hidden/auto (e.g. the
       horizontally-scrolling .dg-wrap), matching the ui-select panel pattern. */
    .dg-action-dropdown {
      position: fixed;
      z-index: 9999;
      background: #fff;
      border: 1px solid #eef1f5;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06);
      min-width: 188px;
      max-height: min(70vh, 380px);
      overflow-y: auto;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .dg-action-dropdown button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      text-align: left;
      background: none;
      border: none;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .dg-action-dropdown button:hover { background: #f1f5f9; color: #0f172a; }
    .dg-action-dropdown button.danger { color: #dc2626; }
    .dg-action-dropdown button.danger:hover { background: #fef2f2; color: #b91c1c; }
    .dg-action-ic {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; flex-shrink: 0; opacity: 0.7;
    }
    .dg-action-sep { height: 1px; background: #f1f5f9; margin: 5px 4px; }

    .dg-empty { text-align: center; padding: 48px 20px; color: #94a3b8; }
    .dg-empty-inner { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .dg-empty-inner svg { opacity: 0.35; }
    .dg-empty-inner p { margin: 0; font-size: 14.5px; }

    /* ── Dark theme ───────────────────────────────────────────── */
    :host(.dark) .dg-wrap { background: rgba(255,255,255,.03); border-color: rgba(255,255,255,.08); }
    :host(.dark) .dg-th {
      background: rgba(255,255,255,.04); color: rgba(255,255,255,.5);
      border-bottom-color: rgba(255,255,255,.08);
    }
    :host(.dark) .dg-th--sortable:hover { color: rgba(255,255,255,.85); }
    :host(.dark) .dg-row:hover { background: rgba(255,255,255,.035); }
    :host(.dark) .dg-row--selected { background: rgb(var(--th-ar,13) var(--th-ag,148) var(--th-ab,136) / .12); }
    :host(.dark) .dg-td { color: rgba(255,255,255,.82); border-bottom-color: rgba(255,255,255,.05); }
    :host(.dark) .dg-person-name { color: #fff; }
    :host(.dark) .dg-person-sub { color: rgba(255,255,255,.5); }
    :host(.dark) .dg-person-code { color: rgba(255,255,255,.4); }
    :host(.dark) .dg-cell-primary { color: #fff; }
    :host(.dark) .dg-cell-sub { color: rgba(255,255,255,.5); }
    :host(.dark) .dg-badge { background: rgba(255,255,255,.08); color: rgba(255,255,255,.72); }
    :host(.dark) .dg-action-btn { color: rgba(255,255,255,.5); }
    :host(.dark) .dg-action-btn:hover { background: rgba(255,255,255,.08); color: #fff; }
    :host(.dark) .dg-empty { color: rgba(255,255,255,.4); }
    :host(.dark) .dg-empty-inner svg { opacity: 0.5; }
    :host(.dark) input[type="checkbox"] { accent-color: var(--accent, #0d9488); }

    :host(.dark) .dg-action-dropdown {
      background: #161623; border-color: rgba(255,255,255,.1);
      box-shadow: 0 16px 48px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4);
    }
    :host(.dark) .dg-action-dropdown button { color: rgba(255,255,255,.82); }
    :host(.dark) .dg-action-dropdown button:hover { background: rgba(255,255,255,.06); color: #fff; }
    :host(.dark) .dg-action-dropdown button.danger { color: #f87171; }
    :host(.dark) .dg-action-dropdown button.danger:hover { background: rgba(239,68,68,.12); color: #fca5a5; }
    :host(.dark) .dg-action-sep { background: rgba(255,255,255,.08); }
  `],
})
export class UiDataGridComponent<T = any> implements OnDestroy {
  @Input() columns: GridColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() actions: GridAction<T>[] = [];
  @Input() trackBy: (row: T) => string | number = (row: any) => row?.id;
  @Input() loading = false;
  @Input() emptyMessage = 'No data found';
  @Input() selectable = false;
  @Input() selectedIds: Set<string | number> = new Set();
  @Input() sortKey: string | null = null;
  @Input() sortDirection: SortDirection = 'asc';
  /** Dark theme variant — for dark-surfaced pages (e.g. the Klock admin area). */
  @Input() dark = false;
  @HostBinding('class.dark') get isDark() { return this.dark; }

  @Output() selectionChange = new EventEmitter<Set<string | number>>();
  @Output() sortChange = new EventEmitter<{ key: string; direction: SortDirection }>();
  @Output() rowClick = new EventEmitter<T>();

  @ContentChildren(GridColumnTemplateDirective)
  templates!: QueryList<GridColumnTemplateDirective>;

  openMenuId = signal<string | number | null>(null);
  menuStyle = signal<Record<string, string>>({});

  private _menuRow: T | null = null;
  private readonly _instanceId = ++_gridSeq;

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef, private zone: NgZone) {
    this._scrollHandler = () => {
      if (this.openMenuId() !== null) this.closeActionMenu();
    };
    this._resizeHandler = () => {
      if (this.openMenuId() !== null) this.closeActionMenu();
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

  @HostListener('document:click')
  onDocumentClick() {
    this.closeActionMenu();
  }

  get totalColumns(): number {
    return this.columns.length + (this.selectable ? 1 : 0) + (this.actions.length ? 1 : 0);
  }

  get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every(r => this.selectedIds.has(this.trackBy(r)));
  }

  cellValue(col: GridColumn<T>, row: T): any {
    if (col.value) return col.value(row);
    return (row as any)?.[col.key];
  }

  badgeClassFor(col: GridColumn<T>, row: T): string {
    const v = this.cellValue(col, row);
    return col.badgeClass ? col.badgeClass(v, row) : String(v ?? '');
  }

  badgeLabelFor(col: GridColumn<T>, row: T): string {
    const v = this.cellValue(col, row);
    return col.badgeLabel ? col.badgeLabel(v, row) : String(v ?? '');
  }

  templateFor(key: string): TemplateRef<any> | null {
    return this.templates?.find(t => t.columnKey === key)?.templateRef ?? null;
  }

  sortIconFor(key: string): 'both' | 'asc' | 'desc' {
    if (this.sortKey !== key) return 'both';
    return this.sortDirection;
  }

  onSort(key: string) {
    if (this.sortKey === key) {
      this.sortChange.emit({ key, direction: this.sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      this.sortChange.emit({ key, direction: 'asc' });
    }
  }

  onToggleRow(row: T) {
    const id = this.trackBy(row);
    const next = new Set(this.selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectionChange.emit(next);
  }

  onToggleSelectAll() {
    const next = new Set(this.selectedIds);
    if (this.allSelected) {
      this.rows.forEach(r => next.delete(this.trackBy(r)));
    } else {
      this.rows.forEach(r => next.add(this.trackBy(r)));
    }
    this.selectionChange.emit(next);
  }

  onRowClick(row: T) {
    this.rowClick.emit(row);
  }

  visibleActions(): GridAction<T>[] {
    if (!this._menuRow) return [];
    const row = this._menuRow;
    return this.actions.filter(a => !a.visible || a.visible(row));
  }

  /** Non-destructive actions, rendered first. */
  normalActions(): GridAction<T>[] {
    return this.visibleActions().filter(a => !a.danger);
  }

  /** Destructive actions, grouped under a divider. */
  dangerActions(): GridAction<T>[] {
    return this.visibleActions().filter(a => a.danger);
  }

  toggleActionMenu(id: string | number, row: T, event: Event) {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.closeActionMenu();
      return;
    }
    this._menuRow = row;
    this.computeMenuPosition(event.currentTarget as HTMLElement);
    this.openMenuId.set(id);
  }

  closeActionMenu() {
    this.openMenuId.set(null);
    this._menuRow = null;
    this.cdr.markForCheck();
  }

  runAction(action: GridAction<T>, event: Event) {
    event.stopPropagation();
    const row = this._menuRow;
    this.closeActionMenu();
    if (row) action.click(row);
  }

  private computeMenuPosition(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    // Estimate the menu height from the actual action count (+ divider/padding)
    // so the upward flip kicks in before it clips the viewport bottom.
    const count = this.visibleActions().length;
    const hasSep = this.normalActions().length && this.dangerActions().length;
    const menuHeight = Math.min(380, count * 38 + (hasSep ? 11 : 0) + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const goUp = spaceBelow < menuHeight && rect.top > spaceBelow;

    const style: Record<string, string> = {
      position: 'fixed',
      right: (window.innerWidth - rect.right) + 'px',
      'z-index': '9999',
    };
    if (goUp) {
      style['bottom'] = (window.innerHeight - rect.top + gap) + 'px';
    } else {
      style['top'] = (rect.bottom + gap) + 'px';
    }
    this.menuStyle.set(style);
  }
}
