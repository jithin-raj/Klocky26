// ─────────────────────────────────────────────────────────────────────────────
// Razorpay checkout.js loader + typings.
//
// The SDK is loaded lazily (only when the billing page opens checkout) rather
// than blocking every page in index.html. loadRazorpay() is idempotent — the
// <script> is injected at most once and the promise resolved from cache after.
// ─────────────────────────────────────────────────────────────────────────────

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Shown in the Checkout modal header — Klock's logo, next to the app name. */
export const KLOCK_LOGO_URL = 'https://klock-api.onrender.com/logo.png';

export interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** Handler payload for a subscription (auto-renew) checkout — no order_id, has subscription_id instead. */
export interface RazorpaySubscriptionHandlerResponse {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptionsBase {
  key: string;
  amount?: number;         // in paise — omitted for subscription checkout (Razorpay reads it off the plan)
  currency?: string;
  name: string;
  /** Logo shown in the Checkout modal header, next to `name`. */
  image?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

/** One-time payment checkout — order_id + a fixed amount. */
export interface RazorpayOrderOptions extends RazorpayOptionsBase {
  order_id: string;
  subscription_id?: never;
  amount: number;
  currency: string;
  handler: (resp: RazorpayHandlerResponse) => void;
}

/** Recurring/auto-renew checkout — subscription_id; Razorpay charges each cycle automatically. */
export interface RazorpaySubscriptionOptions extends RazorpayOptionsBase {
  subscription_id: string;
  order_id?: never;
  handler: (resp: RazorpaySubscriptionHandlerResponse) => void;
}

export type RazorpayOptions = RazorpayOrderOptions | RazorpaySubscriptionOptions;

export interface RazorpayInstance { open(): void; }
type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

let loadPromise: Promise<void> | null = null;

/** Resolves once window.Razorpay is available. Safe to call repeatedly. */
export function loadRazorpay(): Promise<void> {
  if ((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error('Failed to load Razorpay')); };
    document.body.appendChild(script);
  });
  return loadPromise;
}

/** Construct a Razorpay checkout instance (after loadRazorpay() resolves). */
export function createRazorpay(options: RazorpayOptions): RazorpayInstance {
  const Ctor = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  return new Ctor(options);
}
