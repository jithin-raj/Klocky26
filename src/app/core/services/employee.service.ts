import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  AddEmployeeRequest,
  BulkImportResponse,
  EmployeeResponse,
  EmployeeTreeResponse,
  UpdateEmployeeRequest,
} from '../../features/employees/models/employee-api.model';

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeService — Employees CRUD/list/tree/bulk-import, INTEGRATION_GUIDE.md §7.4
//
// Regular employee-token endpoints gated by permission level (add/update/
// activate/deactivate/bulk-import ≥2, delete =3) — not org-admin-scoped, so
// no AUTH_SCOPE context is needed; the interceptor attaches the default
// employee bearer token automatically.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EmployeeService {

  private readonly api = inject(ApiService);

  /** POST /api/employees — add one employee manually */
  create(payload: AddEmployeeRequest): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.post<ApiResponse<EmployeeResponse>>('/employees', payload);
  }

  /** GET /api/employees/{id} */
  getById(id: string): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.get<ApiResponse<EmployeeResponse>>(`/employees/${id}`);
  }

  /** GET /api/employees — flat list, every employee in the org, ordered by name */
  getAll(): Observable<ApiResponse<EmployeeResponse[]>> {
    return this.api.get<ApiResponse<EmployeeResponse[]>>('/employees');
  }

  /** GET /api/employees/tree — org structure: departments with nested employees */
  getTree(): Observable<ApiResponse<EmployeeTreeResponse>> {
    return this.api.get<ApiResponse<EmployeeTreeResponse>>('/employees/tree');
  }

  /** PUT /api/employees/{id} — full update */
  update(id: string, payload: UpdateEmployeeRequest): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.put<ApiResponse<EmployeeResponse>>(`/employees/${id}`, payload);
  }

  /** DELETE /api/employees/{id} — hard delete */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/employees/${id}`);
  }

  /** PATCH /api/employees/{id}/activate */
  activate(id: string): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.patch<ApiResponse<EmployeeResponse>>(`/employees/${id}/activate`, {});
  }

  /** PATCH /api/employees/{id}/deactivate */
  deactivate(id: string): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.patch<ApiResponse<EmployeeResponse>>(`/employees/${id}/deactivate`, {});
  }

  /** POST /api/employees/bulk-import — multipart/form-data, field name `file`, .xlsx or .csv, max 10MB */
  bulkImport(file: File): Observable<ApiResponse<BulkImportResponse>> {
    return this.api.upload<ApiResponse<BulkImportResponse>>('/employees/bulk-import', file, 'file');
  }

  /** GET /api/employees/bulk-import-template — binary .xlsx blob, not JSON */
  downloadBulkImportTemplate(): Observable<Blob> {
    return this.api.getBlob('/employees/bulk-import-template');
  }
}
