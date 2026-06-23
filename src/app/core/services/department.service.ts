import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  AssignDepartmentRequest,
  ClockInPolicyRequest,
  CreateDepartmentRequest,
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

  /** GET /api/departments/getAllDepartments */
  getAll(): Observable<ApiResponse<Department[]>> {
    return this.api.get<ApiResponse<Department[]>>('/departments/getAllDepartments');
  }

  /** POST /api/departments/add/departments */
  create(payload: CreateDepartmentRequest): Observable<ApiResponse<Department>> {
    return this.api.post<ApiResponse<Department>>('/departments/add/departments', payload);
  }

  /** POST /api/departments/assignDepartment */
  assignToDepartment(payload: AssignDepartmentRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/departments/assignDepartment', payload);
  }

  /** PUT /api/departments/{id}/clock-in-policy */
  updateClockInPolicy(id: string, payload: ClockInPolicyRequest): Observable<ApiResponse<Department>> {
    return this.api.put<ApiResponse<Department>>(`/departments/${id}/clock-in-policy`, payload);
  }
}
