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
  | 'face_clock_in'
  | 'biometric_sync'
  | 'leave_automation'
  | 'documents'
  | 'analytics';

/** The allowed feature set — plan/add-on/per-org features are validated against this. */
export const FEATURE_CODES: FeatureCode[] = [
  'geofencing', 'face_clock_in', 'biometric_sync', 'leave_automation', 'documents', 'analytics',
];

/** Human labels for feature codes — used in the upgrade modal / lock tooltips. */
export const FEATURE_LABELS: Record<string, string> = {
  geofencing: 'Geofencing',
  face_clock_in: 'Face Clock-In',
  biometric_sync: 'Biometric Sync',
  leave_automation: 'Leave Automation',
  documents: 'Documents',
  analytics: 'Analytics',
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
