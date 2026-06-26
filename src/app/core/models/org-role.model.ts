// ─────────────────────────────────────────────────────────────────────────────
// Org Role models — INTEGRATION_GUIDE.md §7.5
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/org-roles request body */
export interface CreateOrgRoleRequest {
  name: string;
  hierarchyLevel: number;
  /** Optional department this role belongs to (server-side mapping, being added). */
  departmentId?: string | null;
}

/** POST /api/org-roles/assign request body — orgRoleId: null unassigns */
export interface AssignOrgRoleRequest {
  userId: string;
  orgRoleId?: string | null;
}

/** GET /api/org-roles response item (data) */
export interface OrgRole {
  id: string;
  name: string;
  hierarchyLevel: number;
  isSystemDefault: boolean;
  memberCount: number;
  /** Department this role is mapped to (server-side, being added) — may be null/absent. */
  departmentId?: string | null;
  departmentName?: string | null;
}
