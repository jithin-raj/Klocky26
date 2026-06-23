import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  AssignOrgRoleRequest,
  CreateOrgRoleRequest,
  OrgRole,
} from '../models/org-role.model';

// ─────────────────────────────────────────────────────────────────────────────
// OrgRoleService — Custom org roles CRUD + assignment, INTEGRATION_GUIDE.md §7.5
//
// Regular employee-token endpoints gated by permission level (create ≥2,
// delete =3) — not org-admin-scoped, so no AUTH_SCOPE context is needed; the
// interceptor attaches the default employee bearer token automatically.
// Deleting an isSystemDefault role returns 409 — surface that to the user.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OrgRoleService {

  private readonly api = inject(ApiService);

  /** GET /api/org-roles */
  getAll(): Observable<ApiResponse<OrgRole[]>> {
    return this.api.get<ApiResponse<OrgRole[]>>('/org-roles');
  }

  /** POST /api/org-roles */
  create(payload: CreateOrgRoleRequest): Observable<ApiResponse<OrgRole>> {
    return this.api.post<ApiResponse<OrgRole>>('/org-roles', payload);
  }

  /** DELETE /api/org-roles/{id} — 409 if isSystemDefault */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/org-roles/${id}`);
  }

  /** POST /api/org-roles/assign */
  assignToEmployee(payload: AssignOrgRoleRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/org-roles/assign', payload);
  }
}
