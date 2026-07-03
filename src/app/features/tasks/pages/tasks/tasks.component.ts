import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MOCK_EMPLOYEES } from '../../../employees/models/employee.model';
import { UiSelectComponent, UiDatePickerComponent, UiIconComponent } from '../../../../shared/components';
import { TaskService } from '../../../../core/services/task.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { PendingTaskItem, PendingTaskType } from '../../../../core/models/task.model';

type TaskStatus   = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  assigneeName: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  tags: string[];
  createdAt: string;
}

const MOCK_TASKS: Task[] = [
  { id:'1', title:'Q2 OKR setup',           description:'Define and assign Q2 goals for all teams',        status:'todo',       priority:'high',     assigneeId:'1', assigneeName:'Riya Sharma',    assigneeInitials:'RS', assigneeColor:'#6366f1', dueDate:'2026-05-10', tags:['HR','Planning'],      createdAt:'2026-04-28' },
  { id:'2', title:'Update payroll policy',  description:'Review and update salary revision policy doc',    status:'todo',       priority:'medium',   assigneeId:'9', assigneeName:'Meera Joshi',    assigneeInitials:'MJ', assigneeColor:'#6366f1', dueDate:'2026-05-15', tags:['Finance'],            createdAt:'2026-04-27' },
  { id:'3', title:'Onboard EMP021',         description:'Complete onboarding checklist for new hire',      status:'in_progress',priority:'critical', assigneeId:'3', assigneeName:'Priya Nair',     assigneeInitials:'PN', assigneeColor:'#f59e0b', dueDate:'2026-05-02', tags:['HR','Onboarding'],    createdAt:'2026-04-25' },
  { id:'4', title:'Tech interview panel',   description:'Setup interview panel for 3 open eng roles',      status:'in_progress',priority:'high',     assigneeId:'2', assigneeName:'Arjun Mehta',    assigneeInitials:'AM', assigneeColor:'#ec4899', dueDate:'2026-05-05', tags:['Recruitment'],        createdAt:'2026-04-24' },
  { id:'5', title:'Attendance audit Apr',   description:'Audit April attendance records for discrepancies',status:'review',     priority:'medium',   assigneeId:'3', assigneeName:'Priya Nair',     assigneeInitials:'PN', assigneeColor:'#f59e0b', dueDate:'2026-05-01', tags:['Attendance'],         createdAt:'2026-04-20' },
  { id:'6', title:'Update org chart',       description:'Reflect recent reporting change in org tree',     status:'review',     priority:'low',      assigneeId:'1', assigneeName:'Riya Sharma',    assigneeInitials:'RS', assigneeColor:'#6366f1', dueDate:'2026-04-30', tags:['HR'],                 createdAt:'2026-04-18' },
  { id:'7', title:'Launch engagement survey',description:'Send Q2 pulse survey to all employees',         status:'done',       priority:'high',     assigneeId:'1', assigneeName:'Riya Sharma',    assigneeInitials:'RS', assigneeColor:'#6366f1', dueDate:'2026-04-25', tags:['Engagement'],         createdAt:'2026-04-15' },
  { id:'8', title:'Salary revision letters', description:'Issue salary revision letters for all eligible', status:'done',       priority:'high',     assigneeId:'9', assigneeName:'Meera Joshi',    assigneeInitials:'MJ', assigneeColor:'#6366f1', dueDate:'2026-04-20', tags:['Finance','HR'],       createdAt:'2026-04-10' },
];

@Component({
  selector: 'app-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent, UiIconComponent],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {

  private readonly taskSvc  = inject(TaskService);
  private readonly appState = inject(AppStateService);
  private readonly toast    = inject(ToastService);

  // ── Kanban board ──────────────────────────────────────────────────────
  private _tasks = signal<Task[]>(MOCK_TASKS);
  showAdd     = signal(false);
  dragItem    = signal<string | null>(null);
  filterPrio  = signal('');

  newTitle    = signal('');
  newDesc     = signal('');
  newPriority = signal<TaskPriority>('medium');
  newAssignee = signal('');
  newDue      = signal('');
  newTags     = signal('');

  readonly employees = MOCK_EMPLOYEES;
  readonly columns: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'todo',        label: 'To Do',      color: '#94a3b8' },
    { status: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { status: 'review',      label: 'Review',      color: '#6366f1' },
    { status: 'done',        label: 'Done',        color: '#22c55e' },
  ];

  colTasks(status: TaskStatus) {
    return computed(() => {
      const p = this.filterPrio();
      return this._tasks().filter(t => t.status === status && (!p || t.priority === p));
    });
  }

  moveTo(taskId: string, status: TaskStatus) {
    this._tasks.update(list => list.map(t => t.id === taskId ? { ...t, status } : t));
  }

  addTask() {
    if (!this.newTitle().trim()) return;
    const emp = this.employees.find(e => e.id === this.newAssignee());
    const task: Task = {
      id: Date.now().toString(),
      title: this.newTitle(),
      description: this.newDesc(),
      status: 'todo',
      priority: this.newPriority(),
      assigneeId: emp?.id ?? '',
      assigneeName: emp?.fullName ?? 'Unassigned',
      assigneeInitials: emp?.initials ?? '?',
      assigneeColor: emp?.avatarColor ?? '#94a3b8',
      dueDate: this.newDue(),
      tags: this.newTags().split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString().split('T')[0],
    };
    this._tasks.update(l => [task, ...l]);
    this.showAdd.set(false);
    this.newTitle.set(''); this.newDesc.set(''); this.newDue.set('');
    this.newTags.set(''); this.newAssignee.set('');
  }

  deleteTask(id: string) {
    this._tasks.update(l => l.filter(t => t.id !== id));
  }

  readonly priorities = ['low','medium','high','critical'] as const;
  readonly priorityOptions = this.priorities.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }));
  readonly filterPrioOptions = [{ label: 'All Priorities', value: '' }, ...this.priorityOptions];
  readonly assigneeOptions = [
    { label: 'Unassigned', value: '' },
    ...this.employees.map(e => ({ label: `${e.fullName} – ${e.department}`, value: e.id })),
  ];

  prioColor(p: string) {
    return { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed' }[p] ?? '#94a3b8';
  }

  isOverdue(due: string) {
    return due && new Date(due) < new Date();
  }

  // ── Approvals inbox ───────────────────────────────────────────────────
  readonly canApprove = computed(() => {
    const u = this.appState.user();
    return !!(u?.isManager || u?.isHr || u?.isAdmin);
  });

  pendingTasks   = signal<PendingTaskItem[]>([]);
  loadingPending = signal(false);
  inboxBusyId    = signal<string | null>(null);

  rejectTarget   = signal<PendingTaskItem | null>(null);
  rejectMsg      = signal('');

  readonly pendingCount = computed(() => this.pendingTasks().length);

  ngOnInit() {
    if (this.canApprove()) this.loadPending();
  }

  loadPending() {
    this.loadingPending.set(true);
    this.taskSvc.getPending().subscribe({
      next: items => { this.pendingTasks.set(items); this.loadingPending.set(false); },
      error: ()    => { this.pendingTasks.set([]);   this.loadingPending.set(false); },
    });
  }

  approveTask(item: PendingTaskItem) {
    if (this.inboxBusyId()) return;
    this.inboxBusyId.set(item.id);
    this.taskSvc.doAction({ taskType: item.taskType, taskId: item.id, action: 'approve' }).subscribe({
      next: () => {
        this.inboxBusyId.set(null);
        this.pendingTasks.update(l => l.filter(t => t.id !== item.id));
        this.toast.success('Approved', `${item.title} has been approved.`);
      },
      error: err => {
        this.inboxBusyId.set(null);
        this.toast.error('Could not approve', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  openRejectTask(item: PendingTaskItem) {
    this.rejectTarget.set(item);
    this.rejectMsg.set('');
  }

  cancelReject() {
    this.rejectTarget.set(null);
  }

  confirmReject() {
    const item = this.rejectTarget();
    if (!item || !this.rejectMsg().trim()) return;
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
        this.toast.error('Could not reject', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  taskTypeLabel(t: PendingTaskType): string {
    return t === 'leave_approval' ? 'Leave' : 'Attendance';
  }

  taskTypeBadgeClass(t: PendingTaskType): string {
    return t === 'leave_approval' ? 'tk-badge--leave' : 'tk-badge--attendance';
  }
}
