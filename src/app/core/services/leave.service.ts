import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  CreateLeaveRequest,
  LeaveBalance,
  LeaveDecisionRequest,
  LeaveRequestResponse,
  LeaveRequestView,
  LeaveTypeOption,
  toLeaveView,
} from '../models/leave.model';

// ─────────────────────────────────────────────────────────────────────────────
// LeaveService — /api/leave-requests
//
// Comp-off goes manager → HR (two approvals); other leave is one approval;
// self-approving (full leaves permission) returns approved on submit.
// `pending-approval` returns only what the caller can act on at the current stage.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LeaveService {

  private readonly api = inject(ApiService);

  /** GET /api/leave-requests/types — org-defined leave types (employee-accessible). */
  types(): Observable<LeaveTypeOption[]> {
    return this.api.get<ApiResponse<LeaveTypeOption[]>>('/leave-requests/types')
      .pipe(map(res => res.data ?? []));
  }

  /** GET /api/leave-requests/balances — remaining balance per type (decimal days). */
  balances(): Observable<LeaveBalance[]> {
    return this.api.get<ApiResponse<LeaveBalance[]>>('/leave-requests/balances')
      .pipe(map(res => res.data ?? []));
  }

  /** POST /api/leave-requests — submit a new request (201). */
  create(payload: CreateLeaveRequest): Observable<LeaveRequestResponse> {
    return this.api.post<ApiResponse<LeaveRequestResponse>>('/leave-requests', payload)
      .pipe(map(res => res.data));
  }

  /** GET /api/leave-requests/mine — the caller's own requests. */
  mine(): Observable<LeaveRequestView[]> {
    return this.api.get<ApiResponse<LeaveRequestResponse[] | Paged<LeaveRequestResponse>>>('/leave-requests/mine')
      .pipe(map(res => this._list(res.data)));
  }

  /** GET /api/leave-requests/pending-approval — actionable at the caller's stage. */
  pendingApproval(): Observable<LeaveRequestView[]> {
    return this.api.get<ApiResponse<LeaveRequestResponse[] | Paged<LeaveRequestResponse>>>('/leave-requests/pending-approval')
      .pipe(map(res => this._list(res.data)));
  }

  /** POST /api/leave-requests/{id}/decision — approve / reject at the current stage. */
  decision(id: string, payload: LeaveDecisionRequest): Observable<LeaveRequestView> {
    return this.api.post<ApiResponse<LeaveRequestResponse>>(`/leave-requests/${id}/decision`, payload)
      .pipe(map(res => toLeaveView(res.data)));
  }

  /** POST /api/leave-requests/{id}/cancel — employee revokes their own request. */
  cancel(id: string): Observable<LeaveRequestView> {
    return this.api.post<ApiResponse<LeaveRequestResponse>>(`/leave-requests/${id}/cancel`, {})
      .pipe(map(res => toLeaveView(res.data)));
  }

  private _list(data: LeaveRequestResponse[] | Paged<LeaveRequestResponse> | null | undefined): LeaveRequestView[] {
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return rows.map(toLeaveView);
  }
}
