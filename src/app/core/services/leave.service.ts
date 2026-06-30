import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  CreateLeaveRequest,
  LeaveDecisionRequest,
  LeaveRequestRaw,
  LeaveRequestView,
  normalizeLeaveRequest,
} from '../models/leave.model';

// ─────────────────────────────────────────────────────────────────────────────
// LeaveService — /api/leave-requests
//
// Approval workflow: comp-off goes manager → HR (two approvals), other leave is
// one approval; self-approving (full leaves permission) returns approved on
// submit. `pending-approval` returns only what the caller can act on at the
// current stage. Responses are read defensively (normalizeLeaveRequest) until
// the full DTO is pinned.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LeaveService {

  private readonly api = inject(ApiService);

  /** POST /api/leave-requests — submit a new request. */
  create(payload: CreateLeaveRequest): Observable<LeaveRequestView> {
    return this.api.post<ApiResponse<LeaveRequestRaw>>('/leave-requests', payload)
      .pipe(map(res => normalizeLeaveRequest(res.data)));
  }

  /** GET /api/leave-requests/mine — the caller's own requests. */
  mine(): Observable<LeaveRequestView[]> {
    return this.api.get<ApiResponse<LeaveRequestRaw[] | Paged<LeaveRequestRaw>>>('/leave-requests/mine')
      .pipe(map(res => this._list(res.data)));
  }

  /** GET /api/leave-requests/pending-approval — actionable at the caller's current stage. */
  pendingApproval(): Observable<LeaveRequestView[]> {
    return this.api.get<ApiResponse<LeaveRequestRaw[] | Paged<LeaveRequestRaw>>>('/leave-requests/pending-approval')
      .pipe(map(res => this._list(res.data)));
  }

  /** POST /api/leave-requests/{id}/decision — approve / reject at the current stage. */
  decision(id: string, payload: LeaveDecisionRequest): Observable<LeaveRequestView> {
    return this.api.post<ApiResponse<LeaveRequestRaw>>(`/leave-requests/${id}/decision`, payload)
      .pipe(map(res => normalizeLeaveRequest(res.data)));
  }

  /** POST /api/leave-requests/{id}/cancel — employee revokes their own request. */
  cancel(id: string): Observable<LeaveRequestView> {
    return this.api.post<ApiResponse<LeaveRequestRaw>>(`/leave-requests/${id}/cancel`, {})
      .pipe(map(res => normalizeLeaveRequest(res.data)));
  }

  /** Accepts a bare array or a paged envelope. */
  private _list(data: LeaveRequestRaw[] | Paged<LeaveRequestRaw> | null | undefined): LeaveRequestView[] {
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return rows.map(normalizeLeaveRequest);
  }
}
