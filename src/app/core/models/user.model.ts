// ─────────────────────────────────────────────────────────────────────────────
// Employee auth models — POST /api/users/auth/* (INTEGRATION_GUIDE.md §3)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'admin' | 'hr' | 'manager' | 'employee';
export type ClockInMethod = 'web' | 'mobile' | 'biometric' | 'face';

/** POST /api/users/auth/login request */
export interface LoginRequest {
  orgSlug: string;
  email: string;
  password: string;
}

/** POST /api/users/auth/login response (data) */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  email: string;
  fullName: string;
  role: UserRole;
  orgSlug: string;
  /** Short, suffix-free path segment for routing — see ORG_URL_NAME_INTEGRATION.md. Use this, not orgSlug, for the SPA URL. */
  orgUrlName: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
  mustChangePassword: boolean;
}

/** POST /api/users/auth/refresh request */
export interface RefreshTokenRequest {
  orgSlug: string;
  refreshToken: string;
}

/** POST /api/users/auth/refresh response (data) */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

/** GET /api/users/auth/me response (data) — the full hydrated employee profile */
export interface EmployeeUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  employeeCode: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationTitle: string | null;
  mustChangePassword: boolean;
  reportingManagerId: string | null;
  reportingManagerName: string | null;

  isAdmin: boolean;
  isManager: boolean;
  isHr: boolean;
  /** Identity flag (spec §12) — badge/limit a guest user's own shell as needed. */
  isGuest: boolean;
  /** 1=view only, 2=add+edit, 3=full access — gate write actions on this, not role strings */
  permissionLevel: 1 | 2 | 3;
  allowedClockInMethods: ClockInMethod[] | null;

  orgSlug: string;
  /** Short, suffix-free path segment for routing — see ORG_URL_NAME_INTEGRATION.md. Use this, not orgSlug, for the SPA URL. */
  orgUrlName: string;
  companyName: string;
  displayName: string;
  industry: string | null;
  accentColor: string | null;
  website: string | null;
}

/** PUT /api/users/auth/me request — every field optional */
export interface UpdateMeRequest {
  phone?: string;
  address?: string;
  avatarUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  gender?: string;
  dateOfBirth?: string;
}

/** POST /api/users/auth/change-password, /api/org/auth/change-password, /api/platform/auth/change-password */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
