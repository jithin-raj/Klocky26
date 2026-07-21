import {
  Component, ChangeDetectionStrategy, signal, computed, inject, effect, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, UiDatePickerComponent, UiIconComponent } from '../../../../shared/components';
import { TaskService } from '../../../../core/services/task.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  WorkTaskDto, WorkTaskScope, WorkTaskStatusFilter, WorkTaskPriority,
  CreateWorkTaskRequest, UpdateWorkTaskRequest,
} from '../../../../core/models/task.model';
import { EmployeeHierarchyNode } from '../../../employees/models/employee-api.model';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';

interface AssigneeOption { label: string; value: string; }

@Component({
  selector: 'app-work-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent, UiIconComponent, OrgDateOnlyPipe],
  templateUrl: './work-tasks.component.html',
  styleUrl: './work-tasks.component.scss',
})
export class WorkTasksComponent {

  private readonly taskSvc     = inject(TaskService);
  private readonly realtime    = inject(RealtimeService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly permissions = inject(PermissionService);
  private readonly appState    = inject(AppStateService);
  private readonly toast       = inject(ToastService);

  /** Which scope this instance defaults to — set by the parent tab (e.g. 'mine' for the "My tasks" tab). */
  @Input() set initialScope(v: WorkTaskScope) { this.scope.set(v); }

  // ── Permission gates (feature key 'tasks') ─────────────────────────────
  readonly canCreate = computed(() => this.permissions.can('tasks', 1));
  readonly canAssign = computed(() => this.permissions.can('tasks', 2));

  // ── Filters ─────────────────────────────────────────────────────────────
  scope        = signal<WorkTaskScope>('all');
  statusFilter = signal<WorkTaskStatusFilter>('');

  readonly scopeOptions = [
    { label: 'All',     value: 'all' as WorkTaskScope },
    { label: 'Mine',    value: 'mine' as WorkTaskScope },
    { label: 'Created by me', value: 'created' as WorkTaskScope },
  ];
  readonly statusOptions = [
    { label: 'All statuses', value: '' as WorkTaskStatusFilter },
    { label: 'Open (unfinished)', value: 'open_active' as WorkTaskStatusFilter },
    { label: 'Open',        value: 'open' as WorkTaskStatusFilter },
    { label: 'In Progress', value: 'in_progress' as WorkTaskStatusFilter },
    { label: 'Done',        value: 'done' as WorkTaskStatusFilter },
    { label: 'Cancelled',   value: 'cancelled' as WorkTaskStatusFilter },
  ];

  // ── List state ────────────────────────────────────────────────────────
  tasks    = signal<WorkTaskDto[]>([]);
  loading  = signal(false);
  error    = signal<string | null>(null);
  busyId   = signal<string | null>(null);

  constructor() {
    effect(() => {
      const scope = this.scope();
      const status = this.statusFilter();
      this.loadTasks(scope, status);
    });

    // Live refresh — an assignment/status change elsewhere can affect this list.
    this.realtime.on('notification.created').subscribe(() => this.refresh());
  }

  loadTasks(scope: WorkTaskScope, status: WorkTaskStatusFilter) {
    this.loading.set(true);
    this.error.set(null);
    this.taskSvc.getWorkTasks({ scope, status: status || undefined }).subscribe({
      next: items => { this.tasks.set(items); this.loading.set(false); },
      error: err => {
        this.tasks.set([]);
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? `Request failed (${err?.status ?? 'unknown'})`);
      },
    });
  }

  refresh() {
    this.loadTasks(this.scope(), this.statusFilter());
  }

  // ── Assignee options (direct reports, or everyone for admins) ──────────
  assigneeOptions = signal<AssigneeOption[]>([]);
  private _assigneesLoaded = false;

  private loadAssigneeOptions() {
    if (this._assigneesLoaded || !this.canAssign()) return;
    this._assigneesLoaded = true;

    if (this.permissions.isAdmin()) {
      this.employeeSvc.getAll().subscribe({
        next: res => {
          const list = (res.data ?? [])
            .filter(e => e.employeeId !== this.appState.user()?.userId)
            .map(e => ({ label: e.fullName, value: e.employeeId }));
          this.assigneeOptions.set(list);
        },
        error: () => { /* leave options empty — self-only task still works */ },
      });
      return;
    }

    this.employeeSvc.getMyHierarchyView().subscribe({
      next: res => {
        const meId = this.appState.user()?.userId;
        const reports = meId ? this.findDirectReports(res.data ?? [], meId) : [];
        this.assigneeOptions.set(reports.map(r => ({ label: r.fullName, value: r.employeeId })));
      },
      error: () => { /* leave options empty */ },
    });
  }

  /** Depth-first search for `meId` in the hierarchy tree; returns its immediate `reports`. */
  private findDirectReports(nodes: EmployeeHierarchyNode[], meId: string): EmployeeHierarchyNode[] {
    for (const node of nodes) {
      if (node.employeeId === meId) return node.reports ?? [];
      const nested = this.findDirectReports(node.reports ?? [], meId);
      if (nested.length > 0) return nested;
    }
    return [];
  }

  readonly assigneeSelectOptions = computed(() => [
    { label: 'Myself (personal task)', value: '' },
    ...this.assigneeOptions(),
  ]);

  // ── Create / edit form ───────────────────────────────────────────────────
  showForm     = signal(false);
  editTarget   = signal<WorkTaskDto | null>(null);
  saving       = signal(false);

  formTitle       = signal('');
  formDescription = signal('');
  formPriority    = signal<WorkTaskPriority>('medium');
  formDueDate     = signal('');
  formAssignee    = signal('');

  readonly priorityOptions = [
    { label: 'Low', value: 'low' as WorkTaskPriority },
    { label: 'Medium', value: 'medium' as WorkTaskPriority },
    { label: 'High', value: 'high' as WorkTaskPriority },
  ];

  openCreate() {
    if (!this.canCreate()) return;
    this.editTarget.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formPriority.set('medium');
    this.formDueDate.set('');
    this.formAssignee.set('');
    this.loadAssigneeOptions();
    this.showForm.set(true);
  }

  openEdit(item: WorkTaskDto) {
    if (!item.actions.includes('edit')) return;
    this.editTarget.set(item);
    this.formTitle.set(item.title);
    this.formDescription.set(item.description ?? '');
    this.formPriority.set(item.priority);
    this.formDueDate.set(item.dueDate ?? '');
    this.formAssignee.set(item.isLocal ? '' : item.assignedTo.id);
    this.loadAssigneeOptions();
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editTarget.set(null);
  }

  submitForm() {
    if (!this.formTitle().trim() || this.saving()) return;
    this.saving.set(true);

    const editing = this.editTarget();
    if (!editing) {
      const body: CreateWorkTaskRequest = {
        title: this.formTitle().trim(),
        description: this.formDescription().trim() || null,
        assignedToEmployeeId: this.canAssign() && this.formAssignee() ? this.formAssignee() : null,
        dueDate: this.formDueDate() || null,
        priority: this.formPriority(),
      };
      this.taskSvc.createWorkTask(body).subscribe({
        next: created => {
          this.saving.set(false);
          this.tasks.update(l => [created, ...l]);
          this.toast.success('Task created', created.title);
          this.closeForm();
          this.taskSvc.refreshCounts();
        },
        error: err => {
          this.saving.set(false);
          this.toast.error('Could not create task', err?.error?.error ?? 'Please try again.');
        },
      });
    } else {
      const body: UpdateWorkTaskRequest = {
        title: this.formTitle().trim(),
        description: this.formDescription().trim() || null,
        assignedToEmployeeId: this.canAssign() && this.formAssignee() ? this.formAssignee() : null,
        dueDate: this.formDueDate() || null,
        priority: this.formPriority(),
      };
      this.taskSvc.updateWorkTask(editing.id, body).subscribe({
        next: updated => {
          this.saving.set(false);
          this.tasks.update(l => l.map(t => t.id === updated.id ? updated : t));
          this.toast.success('Task updated', updated.title);
          this.closeForm();
        },
        error: err => {
          this.saving.set(false);
          this.toast.error('Could not update task', err?.error?.error ?? 'Please try again.');
        },
      });
    }
  }

  // ── Row actions ───────────────────────────────────────────────────────────
  completeTask(item: WorkTaskDto) {
    this.setStatus(item, 'done');
  }

  cancelTask(item: WorkTaskDto) {
    this.setStatus(item, 'cancelled');
  }

  private setStatus(item: WorkTaskDto, status: 'done' | 'cancelled') {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    this.taskSvc.updateWorkTask(item.id, { status }).subscribe({
      next: updated => {
        this.busyId.set(null);
        this.tasks.update(l => l.map(t => t.id === updated.id ? updated : t));
        this.taskSvc.refreshCounts();
      },
      error: err => {
        this.busyId.set(null);
        this.toast.error('Could not update task', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  deleteTask(item: WorkTaskDto) {
    if (this.busyId() || !item.actions.includes('delete')) return;
    if (!confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    this.busyId.set(item.id);
    this.taskSvc.deleteWorkTask(item.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.tasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Task deleted');
        this.taskSvc.refreshCounts();
      },
      error: err => {
        this.busyId.set(null);
        this.toast.error('Could not delete task', err?.error?.error ?? 'Please try again.');
      },
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  priorityClass(p: WorkTaskPriority): string {
    return { low: 'wt-prio--low', medium: 'wt-prio--medium', high: 'wt-prio--high' }[p];
  }

  statusClass(s: WorkTaskDto['status']): string {
    return {
      open: 'wt-status--open',
      in_progress: 'wt-status--progress',
      done: 'wt-status--done',
      cancelled: 'wt-status--cancelled',
    }[s];
  }

  statusLabel(s: WorkTaskDto['status']): string {
    return { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }[s];
  }
}
