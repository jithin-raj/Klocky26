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

/** POST /api/attendance-requests request body. `clockIn` required; `date` can't be future. */
export interface CreateAttendanceRequest {
  date: string;          // ISO date (YYYY-MM-DD)
  type: AttendanceRequestType;
  clockIn: string;       // required — "HH:mm" or ISO time
  clockOut?: string;
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
