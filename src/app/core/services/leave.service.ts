import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  ApplyLeaveRequest,
  LeaveBalance,
  LeaveDecisionRequest,
  LeaveRecord,
  LeaveRequestResponse,
  LeaveRequestView,
  LeaveTypeOption,
  MyLeavesResponse,
  toLeaveView,
} from '../models/leave.model';

@Injectable({ providedIn: 'root' })
export class LeaveService {

  private readonly api = inject(ApiService);

  my(): Observable<MyLeavesResponse> {
    return this.api.get<ApiResponse<MyLeavesResponse>>('/leaves/my')
      .pipe(map(res => res.data));
  }

  apply(payload: ApplyLeaveRequest): Observable<LeaveRecord> {
    return this.api.post<ApiResponse<LeaveRecord>>('/leaves/apply', payload)
      .pipe(map(res => res.data));
  }

  pendingApproval(): Observable<LeaveRequestView[]> {
    return this.api.get<ApiResponse<LeaveRequestResponse[] | Paged<LeaveRequestResponse>>>('/leave-requests/pending-approval')
      .pipe(map(res => this._list(res.data)));
  }

  approve(id: string, comment?: string): Observable<LeaveRequestView> {
    return this.api.put<ApiResponse<LeaveRequestResponse>>(`/leaves/${id}/approve`, { comment })
      .pipe(map(res => toLeaveView(res.data)));
  }

  reject(id: string, reason: string): Observable<LeaveRequestView> {
    return this.api.put<ApiResponse<LeaveRequestResponse>>(`/leaves/${id}/reject`, { reason })
      .pipe(map(res => toLeaveView(res.data)));
  }

  cancel(id: string): Observable<LeaveRequestView> {
    return this.api.put<ApiResponse<LeaveRequestResponse>>(`/leaves/${id}/cancel`, {})
      .pipe(map(res => toLeaveView(res.data)));
  }

  types(): Observable<LeaveTypeOption[]> {
    return this.api.get<ApiResponse<LeaveTypeOption[]>>('/leave-requests/types')
      .pipe(map(res => res.data ?? []));
  }

  balances(): Observable<LeaveBalance[]> {
    return this.api.get<ApiResponse<LeaveBalance[]>>('/leave-requests/balances')
      .pipe(map(res => res.data ?? []));
  }

  mine(): Observable<LeaveRequestView[]> {
    return this.my().pipe(
      map(r => (r.records ?? []).map(rec => this._recordToView(rec)))
    );
  }

  decision(id: string, payload: LeaveDecisionRequest): Observable<LeaveRequestView> {
    if (payload.approve) {
      return this.approve(id);
    }
    return this.reject(id, payload.rejectionReason ?? '');
  }

  create(payload: ApplyLeaveRequest): Observable<LeaveRecord> {
    return this.apply(payload);
  }

  private _list(data: LeaveRequestResponse[] | Paged<LeaveRequestResponse> | null | undefined): LeaveRequestView[] {
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return rows.map(toLeaveView);
  }

  private _recordToView(rec: LeaveRecord): LeaveRequestView {
    const base: LeaveRequestResponse = {
      id: rec.id,
      userId: '',
      userFullName: '',
      leaveTypeId: rec.leaveTypeId,
      leaveTypeName: rec.leaveTypeName,
      isCompOff: rec.isCompOff,
      fromDate: rec.fromDate,
      toDate: rec.toDate,
      days: rec.days,
      halfDay: false,
      halfDaySession: null,
      workedDate: null,
      reason: rec.reason ?? null,
      status: rec.status as any,
      approvalStage: rec.approvalStage as any,
      managerApprovedBy: null,
      managerApproverName: null,
      managerApprovedAt: null,
      approvedBy: null,
      approverName: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: '',
    };
    return toLeaveView(base);
  }
}
