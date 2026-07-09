// ─────────────────────────────────────────────────────────────────────────────
// Razorpay checkout.js loader + typings.
//
// The SDK is loaded lazily (only when the billing page opens checkout) rather
// than blocking every page in index.html. loadRazorpay() is idempotent — the
// <script> is injected at most once and the promise resolved from cache after.
// ─────────────────────────────────────────────────────────────────────────────

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;         // in paise
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (resp: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

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
