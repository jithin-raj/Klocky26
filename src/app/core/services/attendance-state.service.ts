import { Injectable, OnDestroy, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RealtimeService } from './realtime.service';
import { ApiResponse } from '../models/api-response.model';
import { ClockInMethod } from '../models/user.model';
import {
  AttendanceRecordResponse,
  CalendarResponse,
  ClockInRequest,
  ClockOutRequest,
  GeofenceConfig,
  LocationPingResponse,
  TeamAttendanceItem,
} from '../models/attendance.model';

export type GeoStatus = 'idle' | 'locating' | 'watching' | 'error';
export type ToastType = 'success' | 'warn' | 'info' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// AttendanceStateService — INTEGRATION_GUIDE.md §4 (clock-in/out/today/ping)
//
// Backed by the real API + SignalR `attendance.updated` push. Geofence
// enforcement itself happens server-side (§6) — this service just starts a
// ping timer when the clock-in response says to (geofencePingIntervalMinutes
// non-null) and stops it the moment the server reports autoClockedOut.
//
// Extension point for later: face-verification clock-in. There is no backend
// face endpoint yet — when one exists, call clockIn('face', { photoUrl })
// with the captured frame uploaded first; do not re-introduce client-side
// face matching/hashing here.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AttendanceStateService implements OnDestroy {

  private readonly api      = inject(ApiService);
  private readonly realtime = inject(RealtimeService);

  // ── Shared state ─────────────────────────────────────────────────────
  readonly status       = signal<AttendanceRecordResponse | null>(null);
  readonly isClockedIn  = signal(false);
  readonly geoStatus    = signal<GeoStatus>('idle');
  readonly geoError     = signal('');
  readonly clockInTime  = signal<Date | null>(null);
  readonly geoToast     = signal('');

  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.realtime.on<AttendanceRecordResponse>('attendance.updated').subscribe((record) => {
      this._applyRecord(record);
    });
  }

  // ── Initial load ───────────────────────────────────────────────────────

  /** GET /api/attendance/today — call once when the attendance widget/shell mounts. */
  refreshToday(): void {
    this.api.get<ApiResponse<AttendanceRecordResponse> | null>('/attendance/today').subscribe({
      next: (res) => this._applyRecord(res?.data ?? null),
      error: () => this._applyRecord(null),
    });
  }

  // ── Clock In ─────────────────────────────────────────────────────────

  /** POST /api/attendance/clock-in */
  clockIn(method: ClockInMethod, extra: Partial<Omit<ClockInRequest, 'method'>> = {}): void {
    const payload: ClockInRequest = { method, ...extra };
    this.api.post<ApiResponse<AttendanceRecordResponse>>('/attendance/clock-in', payload).subscribe({
      next: (res) => {
        this._applyRecord(res.data);
        this.showToast('Clocked in', 'success');
      },
      error: (err) => {
        this.geoStatus.set('idle');
        this.showToast(err?.error?.message ?? 'Could not clock in.', 'error');
      },
    });
  }

  // ── Clock Out ────────────────────────────────────────────────────────

  /** POST /api/attendance/clock-out */
  clockOut(extra: ClockOutRequest = {}): void {
    this.api.post<ApiResponse<AttendanceRecordResponse>>('/attendance/clock-out', extra).subscribe({
      next: (res) => {
        this._applyRecord(res.data);
        this.showToast('Clocked out', 'success');
      },
      error: (err) => {
        this.showToast(err?.error?.message ?? 'Could not clock out.', 'error');
      },
    });
  }

  /** Manual clock-out (header / dashboard button when already clocked in) */
  manualClockOut(): void {
    this.clockOut();
  }

  // ── Geofence ping (only runs when geofencePingIntervalMinutes is non-null) ─

  private _startPingTimer(intervalMinutes: number): void {
    this._stopPingTimer();
    this._pingTimer = setInterval(() => this._sendPing(), intervalMinutes * 60 * 1000);
  }

  private _stopPingTimer(): void {
    if (this._pingTimer !== null) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  private _sendPing(): void {
    if (!navigator.geolocation) return; // no GPS — the server's missed-ping grace window auto-clocks-out as fallback

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.api.post<ApiResponse<LocationPingResponse>>('/attendance/location-ping', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).subscribe({
          next: (res) => {
            this._applyRecord(res.data.status);
            if (res.data.autoClockedOut) {
              this.showToast(
                res.data.status.autoClockedOutReason === 'geofence_exit'
                  ? `Auto clocked-out — you're ${Math.round(res.data.distanceMeters)}m outside the zone.`
                  : 'Auto clocked-out.',
                'warn',
              );
            }
          },
          error: () => { /* transient ping failure — try again next interval */ },
        });
      },
      () => { /* geolocation denied mid-session — let the server's grace window catch it */ },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ── Apply a record from any source (HTTP response or SignalR push) ────

  private _applyRecord(record: AttendanceRecordResponse | null): void {
    this.status.set(record);
    // Prefer the server's authoritative flag (multi-punch); fall back to the
    // legacy "has a clock-in with no clock-out" derive for older responses.
    const clockedIn = !!record && (record.isClockedIn ?? !record.clockOutTime);
    this.isClockedIn.set(clockedIn);
    // Live timer tracks the CURRENT open session, not the day's first clock-in.
    const openSession = record?.sessions?.find(s => !s.clockOutTime);
    const startIso = clockedIn ? (openSession?.clockInTime ?? record?.clockInTime ?? null) : null;
    this.clockInTime.set(startIso ? new Date(startIso) : null);

    if (clockedIn && record?.geofencePingIntervalMinutes) {
      this._startPingTimer(record.geofencePingIntervalMinutes);
    } else {
      this._stopPingTimer();
    }
  }

  // ── Team status (manager/HR/admin only) ────────────────────────────────

  /** GET /api/attendance/team — 403s for regular employees; only call this when the user is a manager/HR/admin. */
  getTeamStatus(): Observable<ApiResponse<TeamAttendanceItem[]>> {
    return this.api.get<ApiResponse<TeamAttendanceItem[]>>('/attendance/team');
  }

  // ── Monthly calendar ────────────────────────────────────────────────────

  /**
   * GET /api/attendance/calendar?year=&month=&userId= — one month of per-day
   * statuses + summary + legend. Omit `userId` for the caller's own calendar;
   * pass it (admin/HR/super-admin) to view another employee's.
   */
  getCalendar(year: number, month: number, userId?: string): Observable<ApiResponse<CalendarResponse>> {
    return this.api.get<ApiResponse<CalendarResponse>>('/attendance/calendar', { year, month, userId });
  }

  /**
   * GET /api/attendance/geofence/config — the caller's effective geofence. Used
   * to hydrate the native layer on login/foreground (MobileBridge forwards it to RN).
   */
  getGeofenceConfig(): Observable<ApiResponse<GeofenceConfig>> {
    return this.api.get<ApiResponse<GeofenceConfig>>('/attendance/geofence/config');
  }

  // ── Toast ────────────────────────────────────────────────────────────
  showToast(msg: string, _type: ToastType): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.geoToast.set(msg);
    this._toastTimer = setTimeout(() => this.geoToast.set(''), 4500);
  }

  ngOnDestroy(): void {
    this._stopPingTimer();
    if (this._toastTimer) clearTimeout(this._toastTimer);
  }
}
