import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, SelectOption } from '../ui-select/ui-select.component';

@Component({
  selector: 'ui-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  template: `
    <div class="ui-pagination">
      <div class="ui-pagination__info">
        @if (resultLabel) {
          {{ resultLabel }}
        }
      </div>
      <div class="ui-pagination__controls">
        <div class="ui-pagesize-ctl">
          <ui-select
            [options]="pageSizeOptions"
            [ngModel]="pageSize"
            (ngModelChange)="onPageSizeChange($event)"
          ></ui-select>
        </div>
        <button class="ui-page-btn" [disabled]="currentPage === 1" (click)="onFirstPage()">«</button>
        <button class="ui-page-btn" [disabled]="currentPage === 1" (click)="onPrevPage()">‹</button>
        @for (p of visiblePages(); track p) {
          <button
            class="ui-page-btn"
            [class.ui-page-btn--active]="currentPage === p"
            (click)="onPageClick(p)"
          >
            {{ p }}
          </button>
        }
        <button class="ui-page-btn" [disabled]="currentPage === totalPages" (click)="onNextPage()">›</button>
        <button class="ui-page-btn" [disabled]="currentPage === totalPages" (click)="onLastPage()">»</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ui-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      border-top: 1.5px solid #e5e7eb;
      background: #f8fafc;
      flex-wrap: wrap;
    }

    .ui-pagination__info {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .ui-pagination__controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ui-pagesize-ctl {
      min-width: 140px;
    }

    .ui-page-btn {
      padding: 6px 10px;
      border: 1.5px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      color: #334155;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      min-width: 32px;
      text-align: center;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--accent, #6366f1) 5%, #fff);
        border-color: color-mix(in srgb, var(--accent, #6366f1) 35%, #e5e7eb);
        color: var(--accent, #6366f1);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &--active {
        background: var(--accent, #6366f1);
        color: #fff;
        border-color: var(--accent, #6366f1);
      }
    }
  `],
})
export class UiPaginationComponent {
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: SelectOption[] = [10, 25, 50].map(n => ({ label: `${n} / page`, value: n }));
  @Input() resultLabel = '';

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly visiblePages = computed(() => {
    const pages: number[] = [];
    const total = this.totalPages;
    const current = this.currentPage;

    // Always show first page
    pages.push(1);

    // Show previous page if not adjacent to first
    if (current > 2) pages.push(current - 1);
    // Show current page if not first or last
    if (current > 1 && current < total) pages.push(current);
    // Show next page if not adjacent to last
    if (current < total - 1) pages.push(current + 1);

    // Always show last page if more than 1 page
    if (total > 1 && pages[pages.length - 1] !== total) {
      pages.push(total);
    }

    // Remove duplicates and sort
    return Array.from(new Set(pages)).sort((a, b) => a - b);
  });

  onFirstPage(): void {
    if (this.currentPage > 1) this.pageChange.emit(1);
  }

  onPrevPage(): void {
    if (this.currentPage > 1) this.pageChange.emit(this.currentPage - 1);
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) this.pageChange.emit(this.currentPage + 1);
  }

  onLastPage(): void {
    if (this.currentPage < this.totalPages) this.pageChange.emit(this.totalPages);
  }

  onPageClick(page: number): void {
    this.pageChange.emit(page);
  }

  onPageSizeChange(size: any): void {
    this.pageSizeChange.emit(+size);
  }
}
