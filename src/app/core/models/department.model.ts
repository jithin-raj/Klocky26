// ─────────────────────────────────────────────────────────────────────────────
// Department models — INTEGRATION_GUIDE.md §7.2
// ─────────────────────────────────────────────────────────────────────────────

import { ClockInMethod } from './user.model';

/** POST /api/departments/add/departments request body */
export interface CreateDepartmentRequest {
  name: string;
  color?: string;
  managerId?: string;
}

/** PUT /api/departments/{id} request body */
export interface UpdateDepartmentRequest {
  name: string;
  color?: string | null;
  managerId?: string | null;
}

/** POST /api/departments/assignDepartment request body — departmentId: null removes them from any department */
export interface AssignDepartmentRequest {
  userId: string;
  departmentId?: string | null;
}

/** PUT /api/departments/{id}/clock-in-policy request body */
export interface ClockInPolicyRequest {
  allowedClockInMethods?: ClockInMethod[];
  requiredOfficeId?: string;
}

/** GET /api/departments/getAllDepartments response item (data) */
export interface Department {
  departmentId: string;
  name: string;
  color: string | null;
  managerId: string | null;
  managerFullName: string | null;
  memberCount: number;
  allowedClockInMethods: ClockInMethod[] | null;
  requiredOfficeId: string | null;
  requiredOfficeName: string | null;
}
