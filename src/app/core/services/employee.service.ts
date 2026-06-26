import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AddEmployeeRequest,
  BulkImportResponse,
  EmployeeHierarchyNode,
  EmployeeResponse,
  EmployeeTreeResponse,
  PayrollCalculation,
  PayrollResponse,
  ResetPasswordResponse,
  UpdateEmployeeRequest,
  UpdatePayrollRequest,
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

  /**
   * GET /api/employees — now a paged endpoint. This convenience overload pulls a
   * large first page and flattens to an array so existing client-side-filtered
   * screens keep working; use `list()` for true server-side paging/search.
   */
  getAll(): Observable<ApiResponse<EmployeeResponse[]>> {
    return this.api.get<ApiResponse<Paged<EmployeeResponse>>>('/employees?page=1&pageSize=100').pipe(
      map(res => ({ ...res, data: res.data?.data ?? [] })),
    );
  }

  /**
   * GET /api/employees — paged + searchable. Returns the raw paged envelope for
   * lazy-load pickers. `managersOnly`/`seniorToLevel` power the reporting-manager
   * dropdown (candidates strictly more senior than `seniorToLevel`).
   */
  list(opts: {
    search?: string; page?: number; pageSize?: number;
    departmentId?: string; managersOnly?: boolean; seniorToLevel?: number;
  } = {}): Observable<ApiResponse<Paged<EmployeeResponse>>> {
    const p = new URLSearchParams();
    p.set('page', String(opts.page ?? 1));
    p.set('pageSize', String(opts.pageSize ?? 10));
    if (opts.search) p.set('search', opts.search);
    if (opts.departmentId) p.set('departmentId', opts.departmentId);
    if (opts.managersOnly) p.set('managersOnly', 'true');
    if (opts.seniorToLevel != null) p.set('seniorToLevel', String(opts.seniorToLevel));
    return this.api.get<ApiResponse<Paged<EmployeeResponse>>>(`/employees?${p.toString()}`);
  }

  /** GET /api/employees/tree — org structure: departments with nested employees */
  getTree(): Observable<ApiResponse<EmployeeTreeResponse>> {
    return this.api.get<ApiResponse<EmployeeTreeResponse>>('/employees/tree');
  }

  /**
   * GET /api/employees/hierarchy — recursive reporting tree rooted at
   * employees with no reportingManagerId (the CEO level), nested by manager.
   * Use this for a true org-chart visual; getTree() is the department-roster
   * view instead.
   */
  getHierarchy(): Observable<ApiResponse<EmployeeHierarchyNode[]>> {
    return this.api.get<ApiResponse<EmployeeHierarchyNode[]>>('/employees/hierarchy');
  }

  /**
   * GET /api/employees/hierarchy/my-view (spec §9) — always allowed. Returns the
   * caller's reporting chain + self + direct reports; the default org-chart view.
   */
  getMyHierarchyView(): Observable<ApiResponse<EmployeeHierarchyNode[]>> {
    return this.api.get<ApiResponse<EmployeeHierarchyNode[]>>('/employees/hierarchy/my-view');
  }

  /** PUT /api/employees/{id} — full update */
  update(id: string, payload: UpdateEmployeeRequest): Observable<ApiResponse<EmployeeResponse>> {
    return this.api.put<ApiResponse<EmployeeResponse>>(`/employees/${id}`, payload);
  }

  /** DELETE /api/employees/{id} — soft delete (default; reversible). */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/employees/${id}`);
  }

  /**
   * DELETE /api/employees/{id}/permanent (spec §4) — permanent, irreversible
   * hard delete. Refuses admin/self; full-access (level 3) only.
   */
  hardDelete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/employees/${id}/permanent`);
  }

  /**
   * POST /api/employees/{id}/reset-password (spec §5) — generates a new password,
   * expires the old one, sets mustChangePassword=true, returns it ONCE.
   */
  generatePassword(id: string): Observable<ApiResponse<ResetPasswordResponse>> {
    return this.api.post<ApiResponse<ResetPasswordResponse>>(`/employees/${id}/reset-password`, {});
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

  // ── Payroll (spec §8) — admin/HR only; any other role gets 403 ────────────────

  /** GET /api/employees/{id}/payroll */
  getPayroll(id: string): Observable<ApiResponse<PayrollResponse>> {
    return this.api.get<ApiResponse<PayrollResponse>>(`/employees/${id}/payroll`);
  }

  /** PUT /api/employees/{id}/payroll */
  updatePayroll(id: string, payload: UpdatePayrollRequest): Observable<ApiResponse<PayrollResponse>> {
    return this.api.put<ApiResponse<PayrollResponse>>(`/employees/${id}/payroll`, payload);
  }

  /** GET /api/employees/{id}/payroll/calculate?year&month */
  calculatePayroll(id: string, year: number, month: number): Observable<ApiResponse<PayrollCalculation>> {
    return this.api.get<ApiResponse<PayrollCalculation>>(`/employees/${id}/payroll/calculate?year=${year}&month=${month}`);
  }
}
