import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  TaskCategory, TaskHistoryItem, Delegation, CreateDelegationRequest,
  PendingTaskItem, TaskAction, TaskActionResult,
} from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {

  private readonly api = inject(ApiService);

  getHistory(params?: { category?: TaskCategory; page?: number; pageSize?: number }): Observable<{ data: TaskHistoryItem[]; total: number }> {
    return this.api.get<ApiResponse<{ data: TaskHistoryItem[]; total: number }>>('/tasks/history', params)
      .pipe(map(res => res.data));
  }

  getDelegations(): Observable<Delegation[]> {
    return this.api.get<ApiResponse<Delegation[]>>('/tasks/delegations')
      .pipe(map(res => res.data ?? []));
  }

  createDelegation(body: CreateDelegationRequest): Observable<Delegation> {
    return this.api.post<ApiResponse<Delegation>>('/tasks/delegations', body)
      .pipe(map(res => res.data));
  }

  updateDelegation(id: string, body: Partial<CreateDelegationRequest>): Observable<Delegation> {
    return this.api.put<ApiResponse<Delegation>>(`/tasks/delegations/${id}`, body)
      .pipe(map(res => res.data));
  }

  deleteDelegation(id: string): Observable<void> {
    return this.api.delete<void>(`/tasks/delegations/${id}`);
  }

  getPending(): Observable<PendingTaskItem[]> {
    return this.api.get<ApiResponse<PendingTaskItem[]>>('/tasks/pending')
      .pipe(map(res => res.data ?? []));
  }

  doAction(body: TaskAction): Observable<TaskActionResult> {
    return this.api.post<ApiResponse<TaskActionResult>>('/tasks/action', body)
      .pipe(map(res => res.data));
  }
}
