import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AttendanceRequestDecision,
  AttendanceRequestResponse,
  CreateAttendanceRequest,
} from '../models/attendance-request.model';

// ─────────────────────────────────────────────────────────────────────────────
// AttendanceRequestService — /api/attendance-requests (regularization)
//
// On approval the server creates/updates that day's attendance record, so the
// change is reflected in GET /api/attendance/calendar. Same approval chain as
// leave; acting on the wrong stage returns 403.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AttendanceRequestService {

  private readonly api = inject(ApiService);

  /** POST /api/attendance-requests — raise a regularization request. */
  create(payload: CreateAttendanceRequest): Observable<AttendanceRequestResponse> {
    return this.api.post<ApiResponse<AttendanceRequestResponse>>('/attendance-requests', payload)
      .pipe(map(res => res.data));
  }

  /** GET /api/attendance-requests/mine — the caller's own requests. */
  mine(): Observable<AttendanceRequestResponse[]> {
    return this.api.get<ApiResponse<AttendanceRequestResponse[] | Paged<AttendanceRequestResponse>>>('/attendance-requests/mine')
      .pipe(map(res => this._list(res.data)));
  }

  /** GET /api/attendance-requests/pending-approval — actionable at the caller's stage. */
  pendingApproval(): Observable<AttendanceRequestResponse[]> {
    return this.api.get<ApiResponse<AttendanceRequestResponse[] | Paged<AttendanceRequestResponse>>>('/attendance-requests/pending-approval')
      .pipe(map(res => this._list(res.data)));
  }

  /** POST /api/attendance-requests/{id}/decision — approve / reject. */
  decision(id: string, payload: AttendanceRequestDecision): Observable<AttendanceRequestResponse> {
    return this.api.post<ApiResponse<AttendanceRequestResponse>>(`/attendance-requests/${id}/decision`, payload)
      .pipe(map(res => res.data));
  }

  /** POST /api/attendance-requests/{id}/cancel — withdraw own pending request. */
  cancel(id: string): Observable<AttendanceRequestResponse> {
    return this.api.post<ApiResponse<AttendanceRequestResponse>>(`/attendance-requests/${id}/cancel`, {})
      .pipe(map(res => res.data));
  }

  private _list(data: AttendanceRequestResponse[] | Paged<AttendanceRequestResponse> | null | undefined): AttendanceRequestResponse[] {
    return Array.isArray(data) ? data : (data?.data ?? []);
  }
}
