import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AppStateService } from './app-state.service';
import { ApiResponse } from '../models/api-response.model';
import {
  AccessLevel,
  PermissionFeature,
  PermissionMeResponse,
  PermissionSubjectResponse,
  UpdatePermissionsRequest,
} from '../models/permission.model';

// ─────────────────────────────────────────────────────────────────────────────
// PermissionService — angular-implementation-spec.md §1, §2, §11
//
// `load()` resolves GET /api/permissions/me into a `key -> level` map that the
// `*hasPermission` directive, `permissionGuard`, and the sidebar gate off. Call
// it right after login (and after token refresh); `clear()` on logout.
//
// §11: admin / super_admin always pass permission checks regardless of the
// matrix — `can()` short-circuits to true for them.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PermissionService {

  private readonly api = inject(ApiService);
  private readonly appState = inject(AppStateService);

  /** featureKey -> resolved access level (0-3) for the current user. */
  private readonly _levels = signal<Map<string, AccessLevel>>(new Map());
  private readonly _loaded = signal(false);

  readonly isAdmin = signal(false);
  readonly isHr = signal(false);
  readonly isGuest = signal(false);

  /** True once /me has been resolved at least once this session. */
  readonly loaded = computed(() => this._loaded());

  /** True for admin / super_admin — they bypass the matrix (§11). */
  private get isPrivileged(): boolean {
    const role = this.appState.userRole();
    return this.isAdmin() || role === 'admin' || role === 'super_admin';
  }

  // ── Resolved access map (§1) ────────────────────────────────────────────────

  /** GET /api/permissions/me — resolve and cache the current user's access map. */
  load(): Observable<ApiResponse<PermissionMeResponse>> {
    return this.api.get<ApiResponse<PermissionMeResponse>>('/permissions/me').pipe(
      tap((res) => this.applyMe(res.data)),
    );
  }

  private applyMe(data: PermissionMeResponse | null | undefined): void {
    const map = new Map<string, AccessLevel>();
    for (const p of data?.permissions ?? []) {
      map.set(p.key, p.level);
    }
    this._levels.set(map);
    this.isAdmin.set(!!data?.isAdmin);
    this.isHr.set(!!data?.isHr);
    this.isGuest.set(!!data?.isGuest);
    this._loaded.set(true);
  }

  /** Resolved access level for a feature key (0 = no access) — privileged users always 3. */
  level(key: string): AccessLevel {
    if (this.isPrivileged) return 3;
    return this._levels().get(key) ?? 0;
  }

  /** True when the current user has at least `minLevel` access to `key`. */
  can(key: string, minLevel: AccessLevel = 1): boolean {
    if (this.isPrivileged) return true;
    return (this._levels().get(key) ?? 0) >= minLevel;
  }

  /** Clear the cached map — call on logout. */
  clear(): void {
    this._levels.set(new Map());
    this.isAdmin.set(false);
    this.isHr.set(false);
    this.isGuest.set(false);
    this._loaded.set(false);
  }

  // ── Matrix editor (§2) ────────────────────────────────────────────────────────

  /** GET /api/permissions/catalog — the fixed feature list, group by `module` in the UI. */
  getCatalog(): Observable<ApiResponse<PermissionFeature[]>> {
    return this.api.get<ApiResponse<PermissionFeature[]>>('/permissions/catalog');
  }

  /** GET /api/permissions/roles/{orgRoleId} */
  getForRole(orgRoleId: string): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.get<ApiResponse<PermissionSubjectResponse>>(`/permissions/roles/${orgRoleId}`);
  }

  /** PUT /api/permissions/roles/{orgRoleId} — full replace; omitted entries revert to the catalog default. */
  updateForRole(orgRoleId: string, payload: UpdatePermissionsRequest): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.put<ApiResponse<PermissionSubjectResponse>>(`/permissions/roles/${orgRoleId}`, payload);
  }

  /** GET /api/permissions/departments/{departmentId} */
  getForDepartment(departmentId: string): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.get<ApiResponse<PermissionSubjectResponse>>(`/permissions/departments/${departmentId}`);
  }

  /** PUT /api/permissions/departments/{departmentId} — full replace; omitted entries revert to the catalog default. */
  updateForDepartment(departmentId: string, payload: UpdatePermissionsRequest): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.put<ApiResponse<PermissionSubjectResponse>>(`/permissions/departments/${departmentId}`, payload);
  }

  /** GET /api/permissions/users/{userId} — per-employee override, department-capped. */
  getForEmployee(userId: string): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.get<ApiResponse<PermissionSubjectResponse>>(`/permissions/users/${userId}`);
  }

  /** PUT /api/permissions/users/{userId} — full replace; omitted entries revert to the catalog default. */
  updateForEmployee(userId: string, payload: UpdatePermissionsRequest): Observable<ApiResponse<PermissionSubjectResponse>> {
    return this.api.put<ApiResponse<PermissionSubjectResponse>>(`/permissions/users/${userId}`, payload);
  }
}
