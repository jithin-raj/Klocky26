import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AssignDepartmentRequest,
  ClockInPolicyRequest,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  Department,
} from '../models/department.model';

// ─────────────────────────────────────────────────────────────────────────────
// DepartmentService — Departments CRUD + clock-in policy, INTEGRATION_GUIDE.md §7.2
//
// Regular employee-token endpoints gated by permission level — not
// org-admin-scoped, so no AUTH_SCOPE context is needed; the interceptor
// attaches the default employee bearer token automatically.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DepartmentService {

  private readonly api = inject(ApiService);

  /** GET /api/departments/getAllDepartments — now paged; flatten a large first page to an array. */
  getAll(): Observable<ApiResponse<Department[]>> {
    return this.api.get<ApiResponse<Paged<Department>>>('/departments/getAllDepartments?page=1&pageSize=100').pipe(
      map(res => ({ ...res, data: res.data?.data ?? [] })),
    );
  }

  /** POST /api/departments/add/departments */
  create(payload: CreateDepartmentRequest): Observable<ApiResponse<Department>> {
    return this.api.post<ApiResponse<Department>>('/departments/add/departments', payload);
  }

  /** PUT /api/departments/{id} — { name, color, managerId? } */
  update(id: string, payload: UpdateDepartmentRequest): Observable<ApiResponse<Department>> {
    return this.api.put<ApiResponse<Department>>(`/departments/${id}`, payload);
  }

  /** POST /api/departments/assignDepartment */
  assignToDepartment(payload: AssignDepartmentRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/departments/assignDepartment', payload);
  }

  /** PUT /api/departments/{id}/clock-in-policy */
  updateClockInPolicy(id: string, payload: ClockInPolicyRequest): Observable<ApiResponse<Department>> {
    return this.api.put<ApiResponse<Department>>(`/departments/${id}/clock-in-policy`, payload);
  }

  /**
   * DELETE /api/departments/{id} — never deletes the department's employees;
   * they fall back to departmentId: null ("Hierarchy" classification),
   * auto-assigned the org's default "Employee" org-role if they had none.
   * Permission level 3 required.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/departments/${id}`);
  }
}
