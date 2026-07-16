import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../../../core/services/task.service';
import { TaskCategory, TaskHistoryItem } from '../../../../core/models/task.model';
import { OrgDatePipe } from '../../../../shared/pipes/localization.pipes';

@Component({
  selector: 'app-task-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, OrgDatePipe],
  templateUrl: './task-history.component.html',
  styleUrl: './task-history.component.scss',
})
export class TaskHistoryComponent implements OnInit {

  private readonly svc = inject(TaskService);

  readonly PAGE_SIZE = 20;

  category = signal<TaskCategory>('all');
  page     = signal(1);
  items    = signal<TaskHistoryItem[]>([]);
  total    = signal(0);
  loading  = signal(false);

  readonly tabs: { label: string; value: TaskCategory }[] = [
    { label: 'All',        value: 'all' },
    { label: 'Attendance', value: 'attendance' },
    { label: 'Request',    value: 'request' },
    { label: 'Work',       value: 'work' },
  ];

  constructor() {
    effect(() => {
      // re-run whenever category or page signal changes
      const cat  = this.category();
      const pg   = this.page();
      this._load(cat, pg);
    });
  }

  ngOnInit() { /* effect fires on first run */ }

  private _load(cat: TaskCategory, pg: number) {
    this.loading.set(true);
    this.svc.getHistory({
      category: cat === 'all' ? undefined : cat,
      page: pg,
      pageSize: this.PAGE_SIZE,
    }).subscribe({
      next: res => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  selectCategory(cat: TaskCategory) {
    this.category.set(cat);
    this.page.set(1);
  }

  prevPage() { if (this.page() > 1) this.page.update(p => p - 1); }
  nextPage() {
    if (this.page() * this.PAGE_SIZE < this.total()) this.page.update(p => p + 1);
  }

  get totalPages(): number { return Math.ceil(this.total() / this.PAGE_SIZE) || 1; }
  get hasPrev(): boolean { return this.page() > 1; }
  get hasNext(): boolean { return this.page() * this.PAGE_SIZE < this.total(); }

  statusClass(status: string): string {
    return {
      completed: 'badge badge--green',
      cancelled: 'badge badge--red',
      expired:   'badge badge--amber',
    }[status] ?? 'badge';
  }

  statusLabel(status: string): string {
    return {
      completed: 'Completed',
      cancelled: 'Cancelled',
      expired:   'Expired',
    }[status] ?? status;
  }
}
