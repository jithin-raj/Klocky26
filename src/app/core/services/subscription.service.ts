import { Injectable, inject, signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  PlansResponse,
  SubscriptionState,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  BillingRecommendation,
  QuoteRequest,
  QuoteResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  VerifySubscriptionRequest,
  VerifySubscriptionResponse,
  CancelAutoRenewResponse,
} from '../models/subscription.model';

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionService — single source of truth for the org's subscription.
//
// Load GET /api/org/subscription once after login (and refresh after a
// payment or after add/removing employees, since usage changes) and cache it.
// This is the STATUS source of truth — the /org/billing/* routes below are
// payment ACTIONS only (quote/create/verify/cancel); they never report status
// themselves, so every one of them re-fetches /org/subscription on success
// rather than trusting their own response body for the org's durable state.
//
// Auth: these endpoints authorise on the *employee* access token (the billing
// route is gated to admin/hr/super_admin via roleGuard on the user session), so
// they use the default 'user' scope — NOT the org-admin step-up token, which a
// normal admin session doesn't carry (that would 401). GET /api/plans is
// anonymous.
//
// Golden rule: this only makes gating graceful — the server still enforces
// caps, features, and expiry (402). If load() fails we keep state null and let
// the server be the gate.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SubscriptionService {

  private readonly api = inject(ApiService);

  /** Cached subscription state (null until first successful load). */
  private readonly _state = signal<SubscriptionState | null>(null);
  private readonly _loading = signal(false);

  /**
   * Optimistic override — set by the login flow (from the login response's
   * `subscriptionExpired`) and by the 402 interceptor, so the gate is known
   * immediately without waiting for a round-trip to `/org/subscription`.
   * `null` = no override, defer to the last-loaded server state. Cleared
   * automatically the next time `load()` succeeds, so server truth always
   * wins once it's available.
   */
  private readonly _forcedExpired = signal<boolean | null>(null);

  /** Reactive slices for templates. */
  readonly state = computed(() => this._state());
  readonly loading = computed(() => this._loading());

  /** Spec contract — an Observable mirror of the cached state. */
  readonly state$: Observable<SubscriptionState | null> = toObservable(this._state);

  // ── Load / refresh ───────────────────────────────────────────────────────

  /** GET /api/org/subscription → cache. Fire-and-forget; safe to call anytime. */
  load(): void {
    this._loading.set(true);
    this.api.get<ApiResponse<SubscriptionState>>('/org/subscription').subscribe({
      next: (res) => {
        this._state.set(res.data ?? null);
        this._forcedExpired.set(null);   // server truth confirmed — drop the optimistic override
        this._loading.set(false);
      },
      error: () => { this._loading.set(false); /* keep prior state; server stays the gate */ },
    });
  }

  /** Clear on logout (state + the trial-banner dismissal, so it doesn't leak across accounts). */
  clear(): void {
    this._state.set(null);
    this._forcedExpired.set(null);
    try { localStorage.removeItem('klocky_trial_banner_dismissed'); } catch { /* ignore */ }
  }

  /**
   * Optimistically flip the expiry gate — called right after login (from
   * `subscriptionExpired` on the login response) or by the 402 interceptor the
   * moment any call is rejected for an expired subscription. Doesn't wait for
   * a `load()` round-trip, so the guard/banner/sidebar react immediately.
   */
  setExpired(expired: boolean): void {
    this._forcedExpired.set(expired);
  }

  // ── Reactive helpers ─────────────────────────────────────────────────────

  hasFeature(code: string): boolean {
    return this._state()?.features?.includes(code) ?? false;
  }

  canAddEmployee(): boolean {
    // No state yet → don't block the UI; the server will reject if over cap.
    return this._state()?.canAddEmployee ?? true;
  }

  /**
   * True when access is blocked (expired/cancelled). The optimistic override
   * wins when set (see `setExpired`); otherwise falls back to the last-loaded
   * server state. Null state and no override → not blocked.
   */
  readonly isExpiredNow = computed(() => {
    const forced = this._forcedExpired();
    if (forced !== null) return forced;
    const s = this._state();
    return s ? !s.accessAllowed : false;
  });

  /** Method form for call-site convenience (guards/interceptors) — same value as `isExpiredNow()`. */
  isExpired(): boolean {
    return this.isExpiredNow();
  }

  isTrial(): boolean {
    return this._state()?.status === 'trial';
  }

  daysLeft(): number | null {
    return this._state()?.daysLeft ?? null;
  }

  // ── API ──────────────────────────────────────────────────────────────────

  /** GET /api/plans — anonymous pricing data. */
  getPlans(): Observable<PlansResponse> {
    return this.api.get<ApiResponse<PlansResponse>>('/plans').pipe(map(res => res.data));
  }

  /**
   * GET /api/org/billing/recommendation — cheapest plan/add-ons/seats covering
   * everything the org currently uses. Used to pre-select the billing picker.
   */
  getRecommendation(): Observable<BillingRecommendation> {
    return this.api.get<ApiResponse<BillingRecommendation>>('/org/billing/recommendation')
      .pipe(map(res => res.data));
  }

  /**
   * POST /api/org/billing/quote — authoritative price + `featuresLost` (features
   * currently ON that the chosen selection won't cover). Call before checkout.
   */
  getQuote(body: QuoteRequest): Observable<QuoteResponse> {
    return this.api.post<ApiResponse<QuoteResponse>>('/org/billing/quote', body)
      .pipe(map(res => res.data));
  }

  /** POST /api/org/billing/create-order. */
  createOrder(body: CreatePaymentOrderRequest): Observable<CreatePaymentOrderResponse> {
    return this.api.post<ApiResponse<CreatePaymentOrderResponse>>('/org/billing/create-order', body)
      .pipe(map(res => res.data));
  }

  /** POST /api/org/billing/verify-payment — refresh cached state on success. */
  verifyPayment(body: VerifyPaymentRequest): Observable<VerifyPaymentResponse> {
    return this.api.post<ApiResponse<VerifyPaymentResponse>>('/org/billing/verify-payment', body)
      .pipe(
        map(res => res.data),
        tap(res => { if (res?.success) this.load(); }),
      );
  }

  // ── Razorpay auto-renew (recurring subscription) ────────────────────────────

  /** POST /api/org/billing/create-subscription — same body as getQuote(). */
  createSubscription(body: CreateSubscriptionRequest): Observable<CreateSubscriptionResponse> {
    return this.api.post<ApiResponse<CreateSubscriptionResponse>>('/org/billing/create-subscription', body)
      .pipe(map(res => res.data));
  }

  /** POST /api/org/billing/verify-subscription — refresh cached state on success. */
  verifySubscription(body: VerifySubscriptionRequest): Observable<VerifySubscriptionResponse> {
    return this.api.post<ApiResponse<VerifySubscriptionResponse>>('/org/billing/verify-subscription', body)
      .pipe(
        map(res => res.data),
        tap(res => { if (res?.success) this.load(); }),
      );
  }

  /** POST /api/org/billing/cancel-auto-renew — no body; refresh cached state on success. */
  cancelAutoRenew(): Observable<CancelAutoRenewResponse> {
    return this.api.post<ApiResponse<CancelAutoRenewResponse>>('/org/billing/cancel-auto-renew', {})
      .pipe(
        map(res => res.data),
        tap(() => this.load()),
      );
  }
}
