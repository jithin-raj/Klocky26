// ─────────────────────────────────────────────────────────────────────────────
// Attendance models — INTEGRATION_GUIDE.md §4
// ─────────────────────────────────────────────────────────────────────────────

import { ClockInMethod } from './user.model';

export type AttendanceStatus = 'present' | 'half' | 'absent' | 'leave' | 'holiday' | 'off';
export type AutoClockedOutReason =
  | 'geofence_exit'
  | 'missed_ping'
  | 'no_ping_timeout'
  | 'auto_checkout_time'
  | 'shift_end'
  | null;

/**
 * One clock-in/out pair within a day (multi-punch). The day's AttendanceRecord
 * is the summary (first-in / last-out / total hours); `sessions` is the detail.
 */
export interface AttendancePunchSession {
  id: string;
  clockInTime: string;
  clockOutTime: string | null;
  clockInMethod: ClockInMethod | null;
  clockOutMethod: ClockInMethod | null;
  autoClockedOutReason: AutoClockedOutReason;
}

/** POST /api/attendance/clock-in request */
export interface ClockInRequest {
  method: ClockInMethod;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}

/** POST /api/attendance/clock-out request — every field optional */
export interface ClockOutRequest {
  method?: ClockInMethod;
  latitude?: number;
  longitude?: number;
  photoUrl?: string | null;
}

/** Shared response shape for clock-in / clock-out / today */
export interface AttendanceRecordResponse {
  attendanceRecordId: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  clockInTime: string | null;
  clockOutTime: string | null;
  hoursWorked: number | null;
  clockInMethod: ClockInMethod | null;
  clockOutMethod: ClockInMethod | null;
  overtimeHours: number | null;
  autoClockedOutReason: AutoClockedOutReason;
  /** Non-null → this employee is geofence-restricted; start the ping timer at this interval */
  geofencePingIntervalMinutes: number | null;
  /** First clock-in was after workDayStart + lateThresholdMins (server-computed). */
  isLate?: boolean;
  /** Authoritative "an open session exists right now" flag (multi-punch). */
  isClockedIn?: boolean;
  /** Per-day clock-in/out pairs (multi-punch); the open one drives the live timer. */
  sessions?: AttendancePunchSession[];
}

/**
 * GET /api/attendance/geofence/config — the caller's effective geofence, used to
 * hydrate the native layer (the web shell forwards it to RN on login/foreground).
 */
export interface GeofenceConfig {
  enabled: boolean;
  officeId: string | null;
  officeName: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  pingIntervalMinutes: number | null;
}

/** POST /api/attendance/location-ping request */
export interface LocationPingRequest {
  latitude: number;
  longitude: number;
}

/** POST /api/attendance/location-ping response (data) */
export interface LocationPingResponse {
  attendanceRecordId: string;
  isWithinGeofence: boolean;
  distanceMeters: number;
  autoClockedOut: boolean;
  status: AttendanceRecordResponse;
}

/** GET /api/attendance/team response (data) item */
export interface TeamAttendanceItem {
  userId: string;
  fullName: string;
  departmentName: string | null;
  today: AttendanceRecordResponse | null;
}

// ── Monthly calendar (GET /api/attendance/calendar?year=&month=&userId=) ──────

/** Per-day status as returned by the calendar endpoint (richer than the live record's). */
export type CalendarDayStatus =
  | 'present' | 'half_day' | 'absent' | 'leave'
  | 'comp_off' | 'holiday' | 'weekend' | 'upcoming';

/** One day in the monthly calendar response. */
export interface CalendarDay {
  /** ISO date YYYY-MM-DD. */
  date: string;
  status: CalendarDayStatus;
  isPresent: boolean;
  isHalfDay: boolean;
  isAbsent: boolean;
  isLeave: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  isUpcoming: boolean;
  presentHours: number | null;
  hoursWorked: number | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  holidayName: string | null;
  leaveTypeName: string | null;
  isPaidLeave: boolean | null;
  /** Server-chosen hex colour for this status. */
  color: string;
}

/** Per-month roll-up returned alongside the days. */
export interface CalendarSummary {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  compOffDays: number;
  holidayDays: number;
  weekendDays: number;
}

/** GET /api/attendance/calendar response (data). */
export interface CalendarResponse {
  userId: string;
  userFullName: string;
  year: number;
  month: number;
  days: CalendarDay[];
  summary: CalendarSummary;
  legend: { status: CalendarDayStatus; label: string; color: string }[];
}
