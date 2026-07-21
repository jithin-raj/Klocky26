import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { RealtimeService } from './realtime.service';
import { ApiResponse } from '../models/api-response.model';
import { asArray, unwrapObject } from '../utils/api-list.util';
import {
  TaskCategory, TaskHistoryItem, Delegation, CreateDelegationRequest,
  PendingTaskItem, TaskAction, TaskActionResult,
  WorkTaskDto, WorkTaskScope, WorkTaskStatusFilter, CreateWorkTaskRequest, UpdateWorkTaskRequest,
  TaskCounts, AllTasksCategory, AllTasksResponse,
} from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {

  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);

  // ── Sidebar badge — self-refreshing, mirrors NotificationService's pattern ──
  private readonly _counts = signal<TaskCounts | null>(null);
  /** Total pending-on-me count for the sidebar "Tasks" badge. */
  readonly total = computed(() => this._counts()?.total ?? 0);

  constructor() {
    // Any live notification (approval request/decision, etc.) can change what's
    // pending on this user — re-pull the counts rather than trying to guess
    // which notification types affect them.
    this.realtime.on('notification.created').subscribe(() => this.refreshCounts());
  }

  /** GET /api/tasks/counts — call once after login/shell-mount, and again after any approve/reject/create. */
  getCounts(): Observable<TaskCounts> {
    return this.api.get<ApiResponse<TaskCounts>>('/tasks/counts')
      .pipe(map(res => unwrapObject<TaskCounts>(res, 'total')));
  }

  refreshCounts(): void {
    this.getCounts().subscribe({ next: c => this._counts.set(c), error: () => { /* keep last-known badge */ } });
  }

  /** GET /api/tasks/all — the unified feed behind the "All" tab. */
  getAll(params?: { category?: AllTasksCategory; page?: number; pageSize?: number }): Observable<AllTasksResponse> {
    return this.api.get<ApiResponse<AllTasksResponse>>('/tasks/all', params)
      .pipe(map(res => unwrapObject<AllTasksResponse>(res, 'pendingApprovals')));
  }

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
    return this.api.get<ApiResponse<PendingTaskItem[] | { data: PendingTaskItem[] }>>('/tasks/pending')
      .pipe(map(res => asArray<PendingTaskItem>(res.data)));
  }

  doAction(body: TaskAction): Observable<TaskActionResult> {
    return this.api.post<ApiResponse<TaskActionResult>>('/tasks/action', body)
      .pipe(map(res => res.data));
  }

  // ── Work tasks ──────────────────────────────────────────────────────────────

  getWorkTasks(params?: { scope?: WorkTaskScope; status?: WorkTaskStatusFilter }): Observable<WorkTaskDto[]> {
    const query: Record<string, string> = {};
    if (params?.scope) query['scope'] = params.scope;
    if (params?.status) query['status'] = params.status;
    return this.api.get<ApiResponse<WorkTaskDto[] | { data: WorkTaskDto[] }>>('/tasks/work', query)
      .pipe(map(res => asArray<WorkTaskDto>(res.data)));
  }

  createWorkTask(body: CreateWorkTaskRequest): Observable<WorkTaskDto> {
    return this.api.post<ApiResponse<WorkTaskDto>>('/tasks/work', body)
      .pipe(map(res => res.data));
  }

  updateWorkTask(id: string, body: UpdateWorkTaskRequest): Observable<WorkTaskDto> {
    return this.api.put<ApiResponse<WorkTaskDto>>(`/tasks/work/${id}`, body)
      .pipe(map(res => res.data));
  }

  deleteWorkTask(id: string): Observable<void> {
    return this.api.delete<void>(`/tasks/work/${id}`);
  }
}
