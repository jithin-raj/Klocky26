// ─────────────────────────────────────────────────────────────────────────────
// Employee API models — INTEGRATION_GUIDE.md §7.4 (employees CRUD/list/tree/
// bulk-import)
// ─────────────────────────────────────────────────────────────────────────────

import { ClockInMethod, UserRole } from '../../../core/models/user.model';

export type EmploymentType = 'full_time' | 'part_time' | 'permanent' | 'contract' | 'intern';
export type Gender = 'male' | 'female' | 'other';

/**
 * POST /api/employees request body.
 *
 * Dual classification (EMPLOYEE_FEATURE_INTEGRATION.md §2.2): every employee
 * is classified by either `departmentId` ("Department" mode) or `orgRoleId`
 * ("Hierarchy" mode, used when departmentId is null) — the API 400s if both
 * are null. `orgRoleId` can now be set directly here instead of a separate
 * POST /api/org-roles/assign call.
 */
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
  orgRoleId?: string | null;
  employmentType?: EmploymentType;
  gender?: Gender;
  dateOfBirth?: string;
  dateOfJoining?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  overrideAllowedClockInMethods?: ClockInMethod[];
  overrideOfficeId?: string | null;
  /**
   * Identity flag only (spec §7) — marks a consultant/auditor/vendor as a guest
   * user. Does NOT change permissions (those are role/matrix driven).
   */
  isGuest?: boolean;
}

/**
 * PUT /api/employees/{id} request body — same shape as AddEmployeeRequest
 * minus email/password, plus dateOfLeaving.
 */
export type UpdateEmployeeRequest = Omit<AddEmployeeRequest, 'email' | 'password'> & {
  dateOfLeaving?: string | null;
};

export type EmployeeClassificationMode = 'Department' | 'Hierarchy';

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
  /** Custom org-role (EMPLOYEE_FEATURE_INTEGRATION.md §2.1) — mandatory when departmentId is null. */
  orgRoleId: string | null;
  orgRoleName: string | null;
  orgRoleHierarchyLevel: number | null;
  /** Computed: "Department" when departmentId is set, "Hierarchy" when it's null (orgRoleId is then mandatory). */
  classificationMode: EmployeeClassificationMode;
  employmentType: EmploymentType | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  dateOfLeaving: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isActive: boolean;
  /** Identity flag (spec §3/§7) — render a "Guest" badge where true. */
  isGuest: boolean;
  overrideAllowedClockInMethods: ClockInMethod[] | null;
  overrideOfficeId: string | null;
  overrideOfficeName: string | null;
  mustChangePassword: boolean;
  /**
   * Payroll figures (spec §3) — `null` unless the caller is admin/HR. Only show
   * payroll columns when these are non-null.
   */
  basicSalary: number | null;
  allowances: number | null;
  otherDeductions: number | null;
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
  orgRoleId: string | null;
  orgRoleName: string | null;
  orgRoleHierarchyLevel: number | null;
}

/**
 * GET /api/employees/hierarchy response item — recursive reporting tree,
 * rooted at employees with no reportingManagerId (the CEO level). Distinct
 * from GET /api/employees/tree (department-grouped roster view); use this
 * one for a true org-chart visual nested by who-reports-to-whom.
 */
export interface EmployeeHierarchyNode {
  employeeId: string;
  fullName: string;
  role: UserRole;
  designationTitle: string | null;
  orgRoleId: string | null;
  orgRoleName: string | null;
  orgRoleHierarchyLevel: number | null;
  isActive: boolean;
  reports: EmployeeHierarchyNode[];
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

/** POST /api/employees/{id}/reset-password response (data) — shown once, not refetchable (spec §5). */
export interface ResetPasswordResponse {
  temporaryPassword: string;
}

// ── Payroll (spec §8) — admin/HR only; any other role gets 403 ────────────────

/** GET /api/employees/{id}/payroll response (data) */
export interface PayrollResponse {
  employeeId: string;
  basicSalary: number;
  allowances: number;
  otherDeductions: number;
  currency: string | null;
}

/** PUT /api/employees/{id}/payroll request */
export interface UpdatePayrollRequest {
  basicSalary: number;
  allowances: number;
  otherDeductions: number;
}

/** GET /api/employees/{id}/payroll/calculate?year&month response (data) */
export interface PayrollCalculation {
  year: number;
  month: number;
  basicSalary: number;
  allowances: number;
  grossPay: number;
  otherDeductions: number;
  netPay: number;
}
