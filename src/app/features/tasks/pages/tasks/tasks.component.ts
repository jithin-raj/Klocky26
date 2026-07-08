import {
  Component, ChangeDetectionStrategy, signal, computed, inject, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiIconComponent } from '../../../../shared/components';
import { TaskService } from '../../../../core/services/task.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { PendingTaskItem, PendingTaskType } from '../../../../core/models/task.model';
import { TaskHistoryComponent } from '../history/task-history.component';
import { WorkTasksComponent } from '../work-tasks/work-tasks.component';

export type TaskListTab = 'all' | 'pending' | 'history';

@Component({
  selector: 'app-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiIconComponent, TaskHistoryComponent, WorkTasksComponent],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent {

  private readonly taskSvc     = inject(TaskService);
  private readonly permissions = inject(PermissionService);
  private readonly toast       = inject(ToastService);

  // ── Tabs ───────────────────────────────────────────────────────────────
  activeTab = signal<TaskListTab>('pending');
  readonly tabs: { id: TaskListTab; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'pending',  label: 'Pending' },
    { id: 'history',  label: 'History' },
  ];

  // ── Approvals inbox ───────────────────────────────────────────────────
  // Gated on the 'attendance' permission key until a dedicated 'tasks' key exists:
  // level 0 = no access (list hidden), level 1 = view only, level 2/3 = can approve/reject/add.
  readonly canView = computed(() => this.permissions.can('attendance', 1));
  readonly canAct  = computed(() => this.permissions.can('attendance', 2));

  pendingTasks   = signal<PendingTaskItem[]>([]);
  loadingPending = signal(false);
  pendingError   = signal<string | null>(null);
  inboxBusyId    = signal<string | null>(null);

  rejectTarget   = signal<PendingTaskItem | null>(null);
  rejectMsg      = signal('');

  viewTarget     = signal<PendingTaskItem | null>(null);

  readonly pendingCount = computed(() => this.pendingTasks().length);

  constructor() {
    // Permissions resolve async (GET /permissions/me fired from the shell) — react
    // once they land instead of checking canView() only at the ngOnInit instant.
    effect(() => {
      if (this.permissions.loaded() && this.canView()) this.loadPending();
    });
  }

  loadPending() {
    this.loadingPending.set(true);
    this.pendingError.set(null);
    this.taskSvc.getPending().subscribe({
      next: items => { this.pendingTasks.set(items); this.loadingPending.set(false); },
      error: err  => {
        this.pendingTasks.set([]);
        this.loadingPending.set(false);
        this.pendingError.set(err?.error?.error ?? err?.message ?? `Request failed (${err?.status ?? 'unknown'})`);
      },
    });
  }

  approveTask(item: PendingTaskItem) {
    if (this.inboxBusyId() || !this.canAct()) return;
    this.inboxBusyId.set(item.id);
    this.taskSvc.doAction({ taskType: item.taskType, taskId: item.id, action: 'approve' }).subscribe({
      next: () => {
        this.inboxBusyId.set(null);
        this.pendingTasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Approved', `${item.title} has been approved.`);
      },
      error: err => {
        this.inboxBusyId.set(null);
        this.toast.error('Could not approve', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  openView(item: PendingTaskItem) {
    this.viewTarget.set(item);
  }

  closeView() {
    this.viewTarget.set(null);
  }

  /** Row-level closing date — use `to`, fall back to `from` for single-day requests. */
  closingDate(item: PendingTaskItem): string | null {
    return item.to ?? item.from;
  }

  openRejectTask(item: PendingTaskItem) {
    if (!this.canAct()) return;
    this.rejectTarget.set(item);
    this.rejectMsg.set('');
  }

  cancelReject() {
    this.rejectTarget.set(null);
  }

  confirmReject() {
    const item = this.rejectTarget();
    if (!item || !this.rejectMsg().trim() || !this.canAct()) return;
    this.inboxBusyId.set(item.id);
    this.taskSvc.doAction({ taskType: item.taskType, taskId: item.id, action: 'reject', message: this.rejectMsg().trim() }).subscribe({
      next: () => {
        this.inboxBusyId.set(null);
        this.rejectTarget.set(null);
        this.pendingTasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Rejected', `${item.title} has been rejected.`);
      },
      error: err => {
        this.inboxBusyId.set(null);
        this.toast.error('Could not reject', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  taskTypeLabel(t: PendingTaskType): string {
    return { leave_approval: 'Leave', regularization_approval: 'Attendance', comp_off_approval: 'Comp-Off' }[t];
  }

  taskTypeBadgeClass(t: PendingTaskType): string {
    return {
      leave_approval: 'tk-badge--leave',
      regularization_approval: 'tk-badge--attendance',
      comp_off_approval: 'tk-badge--compoff',
    }[t];
  }
}
