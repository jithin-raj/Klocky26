import { EmployeeUser } from './user.model';

// ─────────────────────────────────────────────────────────────────────────────
// AppState — the single shape stored (encrypted) in localStorage
// ─────────────────────────────────────────────────────────────────────────────
export interface AppState {
  /** Authenticated employee profile (from GET /api/users/auth/me) */
  user: EmployeeUser | null;

  /** Employee JWT access token (auth_type: "user") — short-lived */
  accessToken: string | null;

  /** Employee refresh token — single-use, 7-day expiry */
  refreshToken: string | null;

  /** Active org slug — the login code (auth_type claim, request bodies). Not the URL segment — see orgUrlName. */
  orgSlug: string | null;

  /** Active org's URL path segment (short, no suffix) — drives theme + org-scoped routing. See ORG_URL_NAME_INTEGRATION.md. */
  orgUrlName: string | null;

  /** Unix ms timestamp when the access token expires */
  expiresAt: number | null;

  /**
   * Org-admin step-up token (auth_type: "org") — only valid for /api/org/auth/*
   * and /api/tenant/register-complete. Obtained via org registration or
   * POST /api/org/auth/login. Kept separate from the employee token; never
   * sent unless a request explicitly opts into AUTH_SCOPE 'org'.
   */
  orgAdminToken: string | null;

  /** Unix ms timestamp when the org-admin token expires */
  orgAdminTokenExpiresAt: number | null;
}

/** Default empty state (unauthenticated) */
export const DEFAULT_APP_STATE: AppState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  orgSlug: null,
  orgUrlName: null,
  expiresAt: null,
  orgAdminToken: null,
  orgAdminTokenExpiresAt: null,
};
