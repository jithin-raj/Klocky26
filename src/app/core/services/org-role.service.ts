import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AssignOrgRoleRequest,
  CreateOrgRoleRequest,
  OrgRole,
} from '../models/org-role.model';

/**
 * The org-roles API has shifted field names across releases — the role id has
 * shown up as `id`, `orgRoleId`, `roleId`, or `_id`. Normalize to `id` so every
 * consumer (permission editor dropdown, employee form) gets a usable value; an
 * empty id makes a <ui-select> mark every option "selected" and blocks the load.
 */
function normalizeOrgRole(r: any): OrgRole {
  return { ...r, id: r?.id || r?.orgRoleId || r?.roleId || r?._id || '' };
}

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

  /** GET /api/org-roles — now paged; flatten a large first page to an array. */
  getAll(): Observable<ApiResponse<OrgRole[]>> {
    return this.api.get<ApiResponse<Paged<OrgRole>>>('/org-roles?page=1&pageSize=100').pipe(
      map(res => ({ ...res, data: (res.data?.data ?? []).map(normalizeOrgRole) })),
    );
  }

  /** POST /api/org-roles */
  create(payload: CreateOrgRoleRequest): Observable<ApiResponse<OrgRole>> {
    return this.api.post<ApiResponse<OrgRole>>('/org-roles', payload);
  }

  /** PUT /api/org-roles/{id} — { name, hierarchyLevel, departmentId? } (re-map or clear the department). */
  update(id: string, payload: CreateOrgRoleRequest): Observable<ApiResponse<OrgRole>> {
    return this.api.put<ApiResponse<OrgRole>>(`/org-roles/${id}`, payload).pipe(
      map(res => ({ ...res, data: res.data ? normalizeOrgRole(res.data) : res.data })),
    );
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
