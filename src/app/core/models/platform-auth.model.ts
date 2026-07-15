// ─────────────────────────────────────────────────────────────────────────────
// Klocky platform-admin auth models — INTEGRATION_GUIDE.md §8
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformLoginRequest {
  email: string;
  password: string;
}

export interface PlatformLoginResponse {
  accessToken: string;
  email: string;
  fullName: string;
  expiresAt: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

/**
 * GET /api/platform/organisations list item. The guide only enumerates this
 * implicitly ("all fields incl. lastActivityAt, inactivityRetentionDays,
 * deletedAt, and every subscription field below" — §8) rather than giving a
 * full response example, so this is a best-effort shape built from the
 * fields named across §8/§9. Confirm against the real response before
 * relying on any field not also listed in PUT's request body below.
 */
export interface PlatformOrgListItem {
  orgSlug: string;
  /** Short, suffix-free path segment for routing — editable only by a Klock platform admin. */
  orgUrlName: string;
  companyName: string;
  primaryEmail: string;
  industry: string | null;
  isActive: boolean;
  accentColor: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  inactivityRetentionDays: number | null;
  deletedAt: string | null;

  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  maxEmployees: number | null;
  maxAdminAccounts: number | null;
  /** Per-org resolved/custom feature codes. */
  features?: string[] | null;
}

/** POST /api/platform/organisations request — minimal-field creation */
export interface CreatePlatformOrgRequest {
  companyName: string;
  primaryEmail: string;
  industry?: string;
  /** Omitted = global default (90 days per the guide) */
  trialDays?: number;
}

/** POST /api/platform/organisations response (data) */
export interface CreatePlatformOrgResponse {
  orgSlug: string;
  /** Shown exactly once — same convention as org self-registration (§1.3) */
  temporaryPassword: string;
  trialEndsAt: string;
}

/**
 * PUT /api/platform/organisations/{slug} request (EditOrganizationRequest) —
 * every field optional; only non-null fields are applied (PATCH-style). Returns
 * OrganizationSummaryResponse (mirrored by PlatformOrgListItem). Note: `industry`
 * is NOT an editable field (it's not in the request or summary response).
 */
export interface UpdatePlatformOrgRequest {
  /** Soft on/off — login is blocked when false. */
  isActive?: boolean;
  /** max 200 */
  companyName?: string;
  /** max 40 — SPA path segment; Klock-admin-only, unique. 400 invalid / 409 taken. */
  orgUrlName?: string;
  /** max 60 — login code; unique. Signs out current sessions. 400 invalid / 409 taken. */
  orgSlug?: string;
  /** max 10 — brand hex e.g. "#2563eb" */
  accentColor?: string;
  /** 1–3650 — days of inactivity before auto backup+delete */
  inactivityRetentionDays?: number;
  subscriptionStatus?: SubscriptionStatus;
  /** ISO datetime */
  trialEndsAt?: string;
  /** plan code, or "custom" for a tailored plan */
  subscriptionPlan?: string;
  /** ISO datetime — paid-period end */
  subscriptionExpiresAt?: string;
  /** 0–100000 */
  maxEmployees?: number;
  /** 0–10000 */
  maxAdminAccounts?: number;
  /** Custom-plan feature grant. [] clears (core only); omit leaves unchanged. */
  features?: string[];
}

/**
 * POST /api/platform/organisations/{slug}/reset-admin-password — REQUESTED,
 * does not exist in INTEGRATION_GUIDE.md today (see SERVER_CHANGES_REQUEST.md
 * §0). There is no way to view a real password (hashed everywhere); this is
 * the legitimate equivalent — generate a fresh one-time temp password for the
 * org's admin, same convention as registration (§1.3).
 */
export interface ResetOrgAdminPasswordResponse {
  temporaryPassword: string;
}

/**
 * DELETE /api/platform/organisations/{slug}[?skipBackup=true] — hard-deletes the
 * org, its tenant DB and payments. Unless skipBackup is set the server writes a
 * backup first and returns its location.
 */
export interface DeleteOrgResult {
  message: string;
  backupPath: string | null;
}

export type OrgEmailType = 'resend_welcome' | 'resend_otp' | 'subscription_alert' | 'custom';

/**
 * POST /api/platform/organisations/{slug}/send-email — REQUESTED, does not
 * exist in INTEGRATION_GUIDE.md today (see SERVER_CHANGES_REQUEST.md §0d).
 * The guide only has automatic, non-retriggerable emails: the registration
 * welcome message (§1.3) and the 24h subscription-expiry job (§9.1). This
 * models an on-demand version a Klock admin can fire manually.
 */
export interface SendOrgEmailRequest {
  type: OrgEmailType;
  /** Required when type === 'custom' */
  subject?: string;
  /** Required when type === 'custom' */
  message?: string;
}
