export type TaskCategory = 'all'|'attendance'|'request'|'work';
export type TaskStatus = 'pending'|'in_progress'|'completed'|'cancelled';

export interface TaskHistoryItem {
  id: string; title: string; category: TaskCategory; status: TaskStatus;
  assignedTo: { id: string; name: string }; completedAt: string | null;
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
