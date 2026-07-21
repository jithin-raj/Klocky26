import {
  Component, ChangeDetectionStrategy, signal, computed, inject, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../../../core/services/task.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import {
  AllTasksCategory, AllTasksResponse, PendingTaskItem, PendingTaskType,
  TaskHistoryItem, WorkTaskDto,
} from '../../../../core/models/task.model';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-all-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OrgDateOnlyPipe],
  templateUrl: './all-tasks.component.html',
  styleUrl: './all-tasks.component.scss',
})
export class AllTasksComponent {

  private readonly taskSvc  = inject(TaskService);
  private readonly realtime = inject(RealtimeService);

  readonly categories: { label: string; value: AllTasksCategory }[] = [
    { label: 'All',        value: 'all' },
    { label: 'Attendance', value: 'attendance' },
    { label: 'Leave',      value: 'leave' },
    { label: 'Comp-Off',   value: 'comp_off' },
    { label: 'Work',       value: 'work' },
  ];

  category = signal<AllTasksCategory>('all');
  page     = signal(1);
  loading  = signal(false);
  error    = signal<string | null>(null);

  private readonly _data = signal<AllTasksResponse>({ pendingApprovals: [], workTasks: [], history: { data: [], total: 0 } });
  readonly pendingApprovals = computed(() => this._data().pendingApprovals);
  readonly workTasks        = computed(() => this._data().workTasks);
  readonly historyItems     = computed(() => this._data().history.data);
  readonly historyTotal     = computed(() => this._data().history.total);

  readonly totalPages = computed(() => Math.ceil(this.historyTotal() / PAGE_SIZE) || 1);
  readonly hasPrev = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() * PAGE_SIZE < this.historyTotal());

  constructor() {
    effect(() => {
      const cat = this.category();
      const pg = this.page();
      this._load(cat, pg);
    });

    // Live refresh — new/decided requests and work-task changes land here too.
    this.realtime.on('notification.created').subscribe(() => this._load(this.category(), this.page()));
  }

  private _load(category: AllTasksCategory, page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.taskSvc.getAll({ category: category === 'all' ? undefined : category, page, pageSize: PAGE_SIZE }).subscribe({
      next: (res) => { this._data.set(res); this.loading.set(false); },
      error: (err) => {
        this._data.set({ pendingApprovals: [], workTasks: [], history: { data: [], total: 0 } });
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? `Request failed (${err?.status ?? 'unknown'})`);
      },
    });
  }

  selectCategory(cat: AllTasksCategory): void {
    this.category.set(cat);
    this.page.set(1);
  }

  prevPage(): void { if (this.hasPrev()) this.page.update(p => p - 1); }
  nextPage(): void { if (this.hasNext()) this.page.update(p => p + 1); }

  taskTypeLabel(t: PendingTaskType): string {
    return { leave_approval: 'Leave', regularization_approval: 'Attendance', comp_off_approval: 'Comp-Off' }[t];
  }

  taskTypeBadgeClass(t: PendingTaskType): string {
    return {
      leave_approval: 'at-badge--leave',
      regularization_approval: 'at-badge--attendance',
      comp_off_approval: 'at-badge--compoff',
    }[t];
  }

  closingDate(item: PendingTaskItem): string | null {
    return item.to ?? item.from;
  }

  workStatusClass(s: WorkTaskDto['status']): string {
    return {
      open: 'at-status--open',
      in_progress: 'at-status--progress',
      done: 'at-status--done',
      cancelled: 'at-status--cancelled',
    }[s];
  }

  workStatusLabel(s: WorkTaskDto['status']): string {
    return { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }[s];
  }

  historyStatusClass(s: TaskHistoryItem['status']): string {
    return {
      completed: 'at-status--done',
      cancelled: 'at-status--cancelled',
      expired: 'at-status--progress',
    }[s] ?? '';
  }
}
