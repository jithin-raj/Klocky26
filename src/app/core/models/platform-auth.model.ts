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

/** PUT /api/platform/organisations/{slug} request — every field optional */
export interface UpdatePlatformOrgRequest {
  isActive?: boolean;
  companyName?: string;
  /** Klock-admin-only rename — ORG_URL_NAME_INTEGRATION.md §3. 400 if format invalid, 409 if taken. */
  orgUrlName?: string;
  accentColor?: string;
  inactivityRetentionDays?: number;
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  maxEmployees?: number;
  maxAdminAccounts?: number;
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
