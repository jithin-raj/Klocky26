export type TaskCategory = 'all'|'attendance'|'request'|'work';
export type TaskStatus = 'pending'|'in_progress'|'completed'|'cancelled';

export interface TaskHistoryItem {
  id: string; title: string; category: TaskCategory; status: TaskStatus;
  assignedTo: { id: string; name: string }; completedAt: string | null;
}

// ── Pending approvals inbox (GET /api/tasks/pending) ─────────────────────────
export type PendingTaskType = 'leave_approval' | 'regularization_approval';

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
  actions: string[];       // ["approve","reject"]
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
