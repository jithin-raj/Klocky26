import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  CarryForwardRequest,
  CarryForwardResult,
  CreditDebitRequest,
  LeaveCategory,
  LeaveCategoryBalance,
  LeaveCategoryUpsert,
} from '../models/leave-category.model';

@Injectable({ providedIn: 'root' })
export class LeaveCategoryService {

  private readonly api = inject(ApiService);

  getAll(includeInactive = false): Observable<LeaveCategory[]> {
    return this.api.get<ApiResponse<LeaveCategory[]>>('/leave-categories', { includeInactive })
      .pipe(map(res => res.data ?? []));
  }

  getById(id: string): Observable<LeaveCategory> {
    return this.api.get<ApiResponse<LeaveCategory>>(`/leave-categories/${id}`)
      .pipe(map(res => res.data));
  }

  create(body: LeaveCategoryUpsert): Observable<LeaveCategory> {
    return this.api.post<ApiResponse<LeaveCategory>>('/leave-categories', body)
      .pipe(map(res => res.data));
  }

  update(id: string, body: Partial<LeaveCategoryUpsert>): Observable<LeaveCategory> {
    return this.api.put<ApiResponse<LeaveCategory>>(`/leave-categories/${id}`, body)
      .pipe(map(res => res.data));
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/leave-categories/${id}`);
  }

  reorder(id: string, sortOrder: number): Observable<void> {
    return this.api.post<void>(`/leave-categories/${id}/reorder`, { sortOrder });
  }

  getBalances(
    id: string,
    params?: { departmentId?: string; officeId?: string; page?: number; pageSize?: number }
  ): Observable<{ data: LeaveCategoryBalance[]; total: number }> {
    return this.api.get<ApiResponse<{ data: LeaveCategoryBalance[]; total: number }>>(
      `/leave-categories/${id}/balances`,
      params
    ).pipe(map(res => res.data));
  }

  credit(id: string, body: CreditDebitRequest): Observable<void> {
    return this.api.post<void>(`/leave-categories/${id}/balances/credit`, body);
  }

  debit(id: string, body: CreditDebitRequest): Observable<void> {
    return this.api.post<void>(`/leave-categories/${id}/balances/debit`, body);
  }

  runCarryForward(body: CarryForwardRequest): Observable<CarryForwardResult> {
    return this.api.post<ApiResponse<CarryForwardResult>>('/leave-categories/carry-forward/run', body)
      .pipe(map(res => res.data));
  }

  getCarryForwardJob(jobId: string): Observable<CarryForwardResult> {
    return this.api.get<ApiResponse<CarryForwardResult>>(`/leave-categories/carry-forward/run/${jobId}`)
      .pipe(map(res => res.data));
  }
}
