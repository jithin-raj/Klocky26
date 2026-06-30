// ─────────────────────────────────────────────────────────────────────────────
// Leave request models — POST/GET /api/leave-requests
//
// The exact base field names weren't pinned in the latest contract (only the new
// approval-stage fields were), so the raw response is read defensively via
// normalizeLeaveRequest() into a stable view model. Tighten these once the full
// DTO is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
/** Which approval step a still-pending request is on. */
export type LeaveApprovalStage = 'manager' | 'hr' | 'completed' | null;

/** POST /api/leave-requests request body (best-effort shape). */
export interface CreateLeaveRequest {
  leaveType: string;
  fromDate: string;   // ISO date
  toDate: string;     // ISO date
  reason?: string;
  halfDay?: boolean;
  /** For comp-off: the worked day being claimed. */
  compOffDate?: string;
}

/** POST /api/leave-requests/{id}/decision request body. */
export interface LeaveDecisionRequest {
  approve: boolean;
  rejectionReason?: string;
}

/** Raw server item — loosely typed; consume via normalizeLeaveRequest(). */
export type LeaveRequestRaw = Record<string, any>;

/** Stable view model the leave UI binds to. */
export interface LeaveRequestView {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  initials: string;
  avatarColor: string;
  leaveType: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approvalStage: LeaveApprovalStage;
  appliedOn: string;
  /** Original payload, in case a screen needs a field not mapped here. */
  raw: LeaveRequestRaw;
}

const AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9'];

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || 'U';
}
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Map a raw leave request (any of several field-name shapes) into LeaveRequestView. */
export function normalizeLeaveRequest(raw: any): LeaveRequestView {
  const id = String(raw?.id ?? raw?.leaveRequestId ?? raw?.uuid ?? '');
  const employeeName = raw?.userFullName ?? raw?.employeeName ?? raw?.fullName ?? 'Employee';
  return {
    id,
    employeeName,
    employeeCode: raw?.employeeCode ?? raw?.userCode ?? '',
    department: raw?.departmentName ?? raw?.department ?? '',
    initials: initialsOf(employeeName),
    avatarColor: colorFor(raw?.userId ?? id ?? employeeName),
    leaveType: raw?.leaveTypeName ?? raw?.leaveType ?? raw?.type ?? '',
    from: raw?.fromDate ?? raw?.startDate ?? raw?.from ?? raw?.dateFrom ?? '',
    to: raw?.toDate ?? raw?.endDate ?? raw?.to ?? raw?.dateTo ?? '',
    days: Number(raw?.numberOfDays ?? raw?.days ?? raw?.totalDays ?? 0),
    reason: raw?.reason ?? '',
    status: (raw?.status ?? 'pending') as LeaveStatus,
    approvalStage: (raw?.approvalStage ?? null) as LeaveApprovalStage,
    appliedOn: raw?.createdAt ?? raw?.appliedOn ?? raw?.requestedAt ?? '',
    raw,
  };
}
