// ─────────────────────────────────────────────────────────────────────────────
// Permission matrix models — angular-implementation-spec.md §1, §2
//
// Two independent, optional axes (OrgRole / Department) can override the access
// level required for a feature, without touching an employee's base `role`.
// `GET /api/permissions/me` (§1) is the single source of truth for showing/hiding
// UI — it returns the caller's resolved level (0-3) per feature key.
// ─────────────────────────────────────────────────────────────────────────────

export type AccessLevel = 0 | 1 | 2 | 3;

export type PermissionSubjectType = 'OrgRole' | 'Department' | 'Employee';

/** GET /api/permissions/catalog response item (data) */
export interface PermissionFeature {
  key: string;
  label: string;
  module: string;
  defaultLevel: AccessLevel;
}

/** Modules whose access level is wired server-side — everything else is UI-only ("coming soon"). */
export const ENFORCED_PERMISSION_MODULES = ['Employees', 'Payroll'] as const;

// ── GET /api/permissions/me (§1) ──────────────────────────────────────────────

/** One resolved feature in the current user's access map. */
export interface ResolvedPermission {
  key: string;
  label: string;
  module: string;
  level: AccessLevel;
  isOverridden: boolean;
  /** Where the resolved level came from, e.g. 'role' | 'department' | 'default'. */
  source: string;
}

/**
 * GET /api/permissions/me response (data) — the caller's resolved access level
 * for every gated feature. Load right after login and after each token refresh;
 * store as a `key -> level` map and gate UI/routes off it.
 */
export interface PermissionMeResponse {
  userId: string;
  permissionLevel: AccessLevel;
  isAdmin: boolean;
  isHr?: boolean;
  isGuest?: boolean;
  permissions: ResolvedPermission[];
}

// ── Matrix editor (§2) ────────────────────────────────────────────────────────

/** GET /api/permissions/roles/{id} or /api/permissions/users/{id} response entry */
export interface PermissionEntry {
  featureKey: string;
  label: string;
  module: string;
  accessLevel: AccessLevel;
  isOverridden: boolean;
  /**
   * Department ceiling (hard cap). The effective level can never exceed this —
   * `effective = min(departmentCap, employeeOverride ?? roleOverride ?? roleBaseline)`.
   * `null` = no cap. The editor must not let a level above `maxSelectable` be chosen.
   */
  departmentCap?: AccessLevel | null;
  /** Highest level the editor may pick = `departmentCap ?? 3`. */
  maxSelectable?: AccessLevel;
  /** True when the department caps this row → disable levels above `maxSelectable`. */
  isCappedByDepartment?: boolean;
}

/** GET /api/permissions/roles/{id} or /api/permissions/departments/{id} response (data) */
export interface PermissionSubjectResponse {
  subjectId: string;
  subjectName: string;
  subjectType: PermissionSubjectType;
  entries: PermissionEntry[];
}

/** PUT /api/permissions/roles/{id} or /api/permissions/departments/{id} request — full replace for this subject */
export interface UpdatePermissionsRequest {
  entries: { featureKey: string; accessLevel: AccessLevel }[];
}
