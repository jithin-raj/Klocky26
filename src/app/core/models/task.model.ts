export type TaskCategory = 'all'|'attendance'|'request'|'work';
export type TaskHistoryStatus = 'completed'|'cancelled'|'expired';

// ── Sidebar badge + "All" tab feed ───────────────────────────────────────────

/** GET /api/tasks/counts response (data) — feeds the sidebar "Tasks" badge. */
export interface TaskCounts {
  pendingApprovals: number;
  openWorkTasks: number;
  total: number;
  leaveApprovals: number;
  attendanceApprovals: number;
  compOffApprovals: number;
}

/** Category filter for GET /api/tasks/all — union of the approval + work categories. */
export type AllTasksCategory = 'all' | 'attendance' | 'leave' | 'comp_off' | 'work';

/** GET /api/tasks/all response (data) — the unified feed behind the "All" tab. */
export interface AllTasksResponse {
  pendingApprovals: PendingTaskItem[];
  workTasks: WorkTaskDto[];
  history: { data: TaskHistoryItem[]; total: number };
}

export interface TaskHistoryItem {
  id: string; title: string; category: TaskCategory; status: TaskHistoryStatus;
  assignedTo: { id: string; name: string }; completedAt: string | null;
}

// ── Pending approvals inbox (GET /api/tasks/pending) ─────────────────────────
export type PendingTaskType = 'leave_approval' | 'regularization_approval' | 'comp_off_approval';

export interface PendingTaskItem {
  id: string;
  taskType: PendingTaskType;
  title: string;
  category: 'approval';
  status: 'pending';
  requestedBy: { id: string; name: string };
  from: string | null;
  to: string | null;
  detail: string | null;
  actions: string[];       // ["approve","reject"] — empty = view-only
  createdAt: string;
}

export interface TaskAction {
  taskType: PendingTaskType;
  taskId: string;
  action: 'approve' | 'reject';
  message?: string;        // optional on approve; REQUIRED on reject
}

export interface TaskActionResult {
  taskId: string;
  taskType: PendingTaskType;
  status: 'approved' | 'rejected';
}

export interface Delegation {
  id: string; delegateToEmployeeId: string; delegateToName: string;
  taskCategory: 'attendance'|'leave'|'work'; startDate: string; endDate?: string;
  reason?: string; isActive: boolean; createdAt: string;
}

export interface CreateDelegationRequest {
  delegateToEmployeeId: string; taskCategory: 'attendance'|'leave'|'work';
  startDate: string; endDate?: string; reason?: string;
}

// ── Work tasks (GET/POST/PUT/DELETE /api/tasks/work) ─────────────────────────
export type WorkTaskScope = 'mine' | 'created' | 'all';
export type WorkTaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type WorkTaskStatusFilter = WorkTaskStatus | 'open_active' | '';
export type WorkTaskPriority = 'low' | 'medium' | 'high';
/** Subset of ["complete","cancel","edit","delete"] — render only what's present. */
export type WorkTaskAction = 'complete' | 'cancel' | 'edit' | 'delete';

export interface WorkTaskDto {
  id: string;
  title: string;
  description: string | null;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string };
  isLocal: boolean;
  dueDate: string | null;
  priority: WorkTaskPriority;
  status: WorkTaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  actions: WorkTaskAction[];
}

export interface CreateWorkTaskRequest {
  title: string;
  description?: string | null;
  assignedToEmployeeId?: string | null;
  dueDate?: string | null;
  priority?: WorkTaskPriority;
}

export interface UpdateWorkTaskRequest {
  title?: string;
  description?: string | null;
  assignedToEmployeeId?: string | null;
  dueDate?: string | null;
  priority?: WorkTaskPriority;
  status?: WorkTaskStatus;
}
