// ─────────────────────────────────────────────────────────────────────────────
// Leave request models — /api/leave-requests
//
// Leave types are org-defined (no fixed codes) — fetch GET /types and send
// leaveTypeId. `days` and all balance figures are decimals (0.5 for half-day).
// ─────────────────────────────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveApprovalStage = 'manager' | 'hr' | 'completed';
export type HalfDaySession = 'first_half' | 'second_half';

/** POST /api/leave-requests request body. */
export interface CreateLeaveRequest {
  leaveTypeId: string;
  fromDate: string;                  // "YYYY-MM-DD"
  toDate: string;                    // "YYYY-MM-DD" (== fromDate for a half-day)
  reason?: string | null;           // max 500
  halfDay?: boolean;                // if true, fromDate must == toDate; counts as 0.5
  halfDaySession?: HalfDaySession | null;
  workedDate?: string | null;       // required when the leave type isCompOff
}

/** POST /api/leave-requests/{id}/decision request body. */
export interface LeaveDecisionRequest {
  approve: boolean;
  rejectionReason?: string;
}

/** GET /api/leave-requests/types item — org-defined leave types. */
export interface LeaveTypeOption {
  leaveTypeId: string;
  name: string;
  isCompOff: boolean;               // true → show the workedDate picker on apply
  isPaid: boolean;
  applicableTo: string;             // "all" | "male" | "female"
  daysPerYear: number;
}

/** GET /api/leave-requests/balances item — all figures are decimal. */
export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName?: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  carriedForward: number;
  remainingDays: number;
}

/** GET/POST /api/leave-requests response item (exact server shape). */
export interface LeaveRequestResponse {
  id: string;
  userId: string;
  userFullName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isCompOff: boolean;
  fromDate: string;
  toDate: string;
  days: number;                     // decimal — 0.5 for half-day
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
  createdAt: string;                // ISO — "applied on"
}

/** UI view model — adds client-computed avatar bits for list rows. */
export interface LeaveRequestView extends LeaveRequestResponse {
  initials: string;
  avatarColor: string;
}

const AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9'];

function initialsOf(name: string): string {
  const p = (name ?? '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || 'U';
}
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Decorate a server response with avatar bits for the approvals/list UI. */
export function toLeaveView(r: LeaveRequestResponse): LeaveRequestView {
  return { ...r, initials: initialsOf(r.userFullName), avatarColor: colorFor(r.userId || r.id) };
}
