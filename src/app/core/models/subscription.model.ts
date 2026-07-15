// ─────────────────────────────────────────────────────────────────────────────
// Subscription / billing models — GET /api/plans, GET /api/org/subscription,
// POST /api/org/billing/create-order, POST /api/org/billing/verify-payment.
//
// Golden rule: FE hiding/locking is UX only. The server enforces caps
// (add-employee), features (settings toggles), and expiry (402). These types
// just make the gating graceful.
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical feature codes used across gating (directive, service, settings). */
export type FeatureCode =
  | 'geofencing'
  | 'biometric_sync'
  | 'leave_automation'
  | 'documents'
  | 'analytics'
  | 'mobile_ios'
  | 'mobile_android'
  | 'face_clock_in';

/**
 * The allowed feature set — plan/add-on/per-org features are validated against
 * this. `face_clock_in` exists but isn't sold as an add-on yet.
 */
export const FEATURE_CODES: FeatureCode[] = [
  'geofencing', 'biometric_sync', 'leave_automation', 'documents', 'analytics',
  'mobile_ios', 'mobile_android', 'face_clock_in',
];

/** Human labels for feature codes — used in the upgrade modal / lock tooltips. */
export const FEATURE_LABELS: Record<string, string> = {
  geofencing: 'Geofencing',
  biometric_sync: 'Biometric Sync',
  leave_automation: 'Leave Automation',
  documents: 'Documents',
  analytics: 'Analytics',
  mobile_ios: 'iOS App',
  mobile_android: 'Android App',
  face_clock_in: 'Face Clock-In',
};

// ── GET /api/plans (anonymous) ───────────────────────────────────────────────

export interface PlanDto {
  code: string;
  name: string;
  description: string;
  maxEmployees: number | null;
  maxAdmins: number | null;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  features: string[];
}

export interface AddonDto {
  code: string;
  name: string;
  feature: string;
  monthlyPrice: number;
  annualPrice: number;
}

export interface PlansResponse {
  plans: PlanDto[];
  addons: AddonDto[];
  extraSeatMonthlyPrice: number;
  trialDays: number;
  currency: string;
}

// ── GET /api/org/subscription (org-admin bearer; reachable even when expired) ─

export type SubStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface SubscriptionState {
  status: SubStatus;
  plan: string | null;
  isCustom: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  daysLeft: number | null;
  accessAllowed: boolean;
  limits: { maxEmployees: number | null; maxAdmins: number | null };
  usage: { employees: number; admins: number };
  features: string[];
  canAddEmployee: boolean;
  /** Extra seats to buy so the current headcount fits the plan (0 if it fits). */
  extraSeatsNeeded: number;
  /** True when Razorpay auto-renew (recurring subscription) is active for the current plan. */
  autoRenewEnabled: boolean;
}

// ── Billing / payment ────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'annual';

export interface CreatePaymentOrderRequest {
  planCode: string;
  billingCycle: BillingCycle;
  addons?: string[];       // add-on codes
  extraSeats?: number;
}

export interface CreatePaymentOrderResponse {
  gatewayOrderId: string;
  razorpayKeyId: string;
  amount: number;          // in major units (e.g. rupees); Razorpay wants paise (×100)
  currency: string;
  planCode: string;
  billingCycle: string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  subscriptionPlan: string | null;
}

// ── GET /api/org/billing/recommendation (org-admin bearer) ───────────────────
// The cheapest plan + add-ons + extra seats that covers everything the org
// currently has switched on. Used to pre-select the billing picker so the
// trial→paid step is one click.

export interface BillingRecommendation {
  planCode: string;
  planName: string;
  addons: string[];
  extraSeats: number;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  /** Features the org actually uses (drives what the recommendation must cover). */
  requiredFeatures: string[];
  /** False only when something they use isn't offered by any plan/add-on. */
  allFeaturesCovered: boolean;
}

// ── POST /api/org/billing/quote (org-admin bearer) ───────────────────────────
// Authoritative pricing for a chosen selection, plus a downgrade warning:
// featuresLost = features currently ON in settings that this selection won't
// cover (shown as a confirm before checkout; disabled on payment).

export interface QuoteRequest {
  planCode: string;
  billingCycle: BillingCycle;
  addons?: string[];
  extraSeats?: number;
}

export interface QuoteLineItem {
  label: string;
  amount: number;
}

export interface QuoteResponse {
  planCode: string;
  billingCycle: string;
  currency: string;
  lineItems: QuoteLineItem[];  // itemised breakdown (plan, add-ons, extra seats)
  total: number;               // authoritative total for the billing cycle
  featuresLost: string[];      // currently-enabled features this selection drops
}

// ── Razorpay auto-renew (recurring subscription) — /api/org/billing/* ────────
// Parallel to the one-time create-order/verify-payment flow above: this opens
// Razorpay Checkout with a `subscription_id` instead of an `order_id`, so
// Razorpay itself charges the card automatically each cycle.

/** POST /api/org/billing/create-subscription — same body shape as the quote request. */
export type CreateSubscriptionRequest = QuoteRequest;

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  razorpayKeyId: string;
  /** Hosted Razorpay authorization link — fallback if the Checkout widget can't open. */
  shortUrl: string;
  amount: number;
  currency: string;
  planCode: string;
  billingCycle: string;
}

export interface VerifySubscriptionRequest {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifySubscriptionResponse {
  success: boolean;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  subscriptionPlan: string | null;
  autoRenewEnabled: boolean;
}

/** POST /api/org/billing/cancel-auto-renew — no body. */
export interface CancelAutoRenewResponse {
  message: string;
}
