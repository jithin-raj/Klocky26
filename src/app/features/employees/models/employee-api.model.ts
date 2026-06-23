// ─────────────────────────────────────────────────────────────────────────────
// Employee API models — INTEGRATION_GUIDE.md §7.4 (employees CRUD/list/tree/
// bulk-import)
// ─────────────────────────────────────────────────────────────────────────────

import { ClockInMethod, UserRole } from '../../../core/models/user.model';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type Gender = 'male' | 'female' | 'other';

/** POST /api/employees request body */
export interface AddEmployeeRequest {
  email: string;
  password?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  employeeCode?: string;
  departmentId?: string | null;
  reportingManagerId?: string | null;
  designationId?: string | null;
  employmentType?: EmploymentType;
  gender?: Gender;
  dateOfBirth?: string;
  dateOfJoining?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  overrideAllowedClockInMethods?: ClockInMethod[];
  overrideOfficeId?: string | null;
}

/**
 * PUT /api/employees/{id} request body — same shape as AddEmployeeRequest
 * minus email/password, plus dateOfLeaving.
 */
export type UpdateEmployeeRequest = Omit<AddEmployeeRequest, 'email' | 'password'> & {
  dateOfLeaving?: string | null;
};

/** Returned by add/get/update/activate/deactivate, and items in the flat list GET /api/employees */
export interface EmployeeResponse {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  employeeCode: string;
  departmentId: string | null;
  departmentName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  designationId: string | null;
  designationTitle: string | null;
  employmentType: EmploymentType | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  dateOfLeaving: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isActive: boolean;
  overrideAllowedClockInMethods: ClockInMethod[] | null;
  overrideOfficeId: string | null;
  overrideOfficeName: string | null;
  mustChangePassword: boolean;
  /** Only ever non-null on the response to the POST (or a platform-admin reset) that generated it. */
  temporaryPassword: string | null;
}

/** Employee node nested inside a department in the org tree */
export interface EmployeeTreeNode {
  employeeId: string;
  fullName: string;
  role: UserRole;
  designationTitle: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  reportingManagerId: string | null;
}

/** Department node returned by GET /api/employees/tree — flat, org-scoped, no parentDepartmentId */
export interface EmployeeTreeDepartment {
  departmentId: string;
  name: string;
  color: string | null;
  managerId: string | null;
  managerFullName: string | null;
  employees: EmployeeTreeNode[];
}

/** GET /api/employees/tree response (data) */
export interface EmployeeTreeResponse {
  companyName: string;
  orgSlug: string;
  orgUrlName: string;
  departments: EmployeeTreeDepartment[];
  unassignedEmployees: EmployeeTreeNode[];
}

/** Per-row result inside BulkImportResponse */
export interface BulkImportRowResult {
  rowNumber: number;
  email: string;
  success: boolean;
  errorMessage: string | null;
}

/** POST /api/employees/bulk-import response (data) */
export interface BulkImportResponse {
  totalRows: number;
  successCount: number;
  failureCount: number;
  results: BulkImportRowResult[];
}
