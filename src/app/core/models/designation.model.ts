// ─────────────────────────────────────────────────────────────────────────────
// Designation models — INTEGRATION_GUIDE.md §7.3
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/designations request body */
export interface CreateDesignationRequest {
  title: string;
}

/** POST /api/designations/assign request body — designationId: null unassigns */
export interface AssignDesignationRequest {
  userId: string;
  designationId?: string | null;
}

/** GET /api/designations response item (data) */
export interface Designation {
  designationId: string;
  title: string;
  memberCount: number;
}
