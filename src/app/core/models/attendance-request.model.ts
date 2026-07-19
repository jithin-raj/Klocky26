// ─────────────────────────────────────────────────────────────────────────────
// Attendance regularization — /api/attendance-requests ("apply for attendance")
//
// Employees raise a request to fix/justify a day (missed punch, WFH, on-duty,
// correction). On approval the server creates/updates that day's attendance
// record (shows up in GET /api/attendance/calendar). Same manager→HR approval
// chain as leave; self-approve via full attendance permission.
// ─────────────────────────────────────────────────────────────────────────────

export type AttendanceRequestType = 'missed_punch' | 'wfh' | 'on_duty' | 'correction';
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** POST /api/attendance-requests request body. `date` can't be future. */
export interface CreateAttendanceRequest {
  date: string;          // ISO date (YYYY-MM-DD)
  type: AttendanceRequestType;
  clockIn?: string;      // UTC ISO datetime e.g. "2024-01-15T04:00:00.000Z" — omit for WFH
  clockOut?: string;     // UTC ISO datetime (optional)
  officeId?: string;
  reason?: string;
}

/** POST /api/attendance-requests/{id}/decision request body. */
export interface AttendanceRequestDecision {
  approve: boolean;
  rejectionReason?: string;
}

/** GET/POST /api/attendance-requests response item. */
export interface AttendanceRequestResponse {
  id: string;
  userId: string;
  userFullName: string;
  date: string;
  type: AttendanceRequestType;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  officeId: string | null;
  officeName: string | null;
  officeAddress: string | null;
  reason: string | null;
  status: AttendanceRequestStatus;
  approvedBy: string | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** Human labels for the request types. */
export const ATTENDANCE_REQUEST_TYPE_LABELS: Record<AttendanceRequestType, string> = {
  missed_punch: 'Missed Punch',
  wfh: 'Work From Home',
  on_duty: 'On Duty',
  correction: 'Correction',
};

/**
 * POST /api/attendance-requests/mark-present request — admin/HR marking an
 * absent/half/missing day present directly (no employee-initiated request).
 * Requires 'attendance' permission level >= 2, or admin. Caller may only mark
 * present for their direct reports (403 otherwise).
 */
export interface MarkPresentRequest {
  userId: string;
  date: string;        // ISO date (YYYY-MM-DD)
  clockIn?: string;     // UTC ISO datetime — omit to use standard office hours
  clockOut?: string;    // UTC ISO datetime — omit to use standard office hours
  note?: string;
}

/** POST /api/attendance-requests/mark-present response (data). */
export interface MarkPresentResponse {
  userId: string;
  date: string;
  status: 'present';
  hoursWorked: number;
  message: string;
}

/** POST /api/attendance-requests/mark-present/bulk request. Max 500 items. */
export interface MarkPresentBulkRequest {
  items: MarkPresentRequest[];
}

/** One item's outcome within a bulk mark-present response. */
export interface MarkPresentBulkResultItem {
  userId: string;
  date: string;
  success: boolean;
  message: string;
}

/** POST /api/attendance-requests/mark-present/bulk response (data). */
export interface MarkPresentBulkResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: MarkPresentBulkResultItem[];
}
