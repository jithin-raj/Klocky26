export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveApprovalStage = 'manager' | 'hr' | 'completed';
export type HalfDaySession = 'first_half' | 'second_half';

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName?: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  carriedForward: number;
  remainingDays: number;
}

export interface LeaveRecord {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isCompOff: boolean;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
  approvalStage: string;
  reason?: string;
}

export interface MyLeavesResponse {
  balances: LeaveBalance[];
  records: LeaveRecord[];
}

export interface ApplyLeaveRequest {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  halfDay?: boolean;
  halfDaySession?: 'first_half' | 'second_half';
  workedDate?: string;
}

export interface LeaveDecisionRequest {
  approve: boolean;
  rejectionReason?: string;
}

export interface LeaveTypeOption {
  leaveTypeId: string;
  name: string;
  isCompOff: boolean;
  isPaid: boolean;
  applicableTo: string;
  daysPerYear: number;
}

export interface LeaveRequestResponse {
  id: string;
  userId: string;
  userFullName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isCompOff: boolean;
  fromDate: string;
  toDate: string;
  days: number;
  halfDay: boolean;
  halfDaySession: string | null;
  workedDate: string | null;
  reason: string | null;
  status: LeaveStatus;
  approvalStage: LeaveApprovalStage;
  managerApprovedBy: string | null;
  managerApproverName: string | null;
  managerApprovedAt: string | null;
  approvedBy: string | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface LeaveRequestView extends LeaveRequestResponse {
  initials: string;
  avatarColor: string;
}

export const AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9'];

export function initialsOf(name: string): string {
  const p = (name ?? '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || 'U';
}

export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function toLeaveView(r: LeaveRequestResponse): LeaveRequestView {
  return { ...r, initials: initialsOf(r.userFullName), avatarColor: colorFor(r.userId || r.id) };
}
