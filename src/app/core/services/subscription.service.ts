import { Injectable, inject, signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { AUTH_SCOPE } from '../http/auth-scope.context';
import {
  PlansResponse,
  SubscriptionState,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '../models/subscription.model';

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionService — single source of truth for the org's subscription.
//
// Load GET /api/org/subscription once after login (and refresh after a payment
// or after add/removing employees, since usage changes) and cache it. The
// billing endpoints are org-admin-scoped, so requests carry AUTH_SCOPE 'org'
// (same convention as OrgAuthService); GET /api/plans is anonymous.
//
// Golden rule: this only makes gating graceful — the server still enforces
// caps, features, and expiry (402). If load() fails we keep state null and let
// the server be the gate.
// ─────────────────────────────────────────────────────────────────────────────

const ORG_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'org') };

@Injectable({ providedIn: 'root' })
export class SubscriptionService {

  private readonly api = inject(ApiService);

  /** Cached subscription state (null until first successful load). */
  private readonly _state = signal<SubscriptionState | null>(null);
  private readonly _loading = signal(false);

  /** Reactive slices for templates. */
  readonly state = computed(() => this._state());
  readonly loading = computed(() => this._loading());

  /** Spec contract — an Observable mirror of the cached state. */
  readonly state$: Observable<SubscriptionState | null> = toObservable(this._state);

  // ── Load / refresh ───────────────────────────────────────────────────────

  /** GET /api/org/subscription → cache. Fire-and-forget; safe to call anytime. */
  load(): void {
    this._loading.set(true);
    this.api.get<ApiResponse<SubscriptionState>>('/org/subscription', undefined, ORG_SCOPE).subscribe({
      next: (res) => { this._state.set(res.data ?? null); this._loading.set(false); },
      error: ()   => { this._loading.set(false); /* keep prior state; server stays the gate */ },
    });
  }

  /** Clear on logout (state + the trial-banner dismissal, so it doesn't leak across accounts). */
  clear(): void {
    this._state.set(null);
    try { localStorage.removeItem('klocky_trial_banner_dismissed'); } catch { /* ignore */ }
  }

  // ── Reactive helpers ─────────────────────────────────────────────────────

  hasFeature(code: string): boolean {
    return this._state()?.features?.includes(code) ?? false;
  }

  canAddEmployee(): boolean {
    // No state yet → don't block the UI; the server will reject if over cap.
    return this._state()?.canAddEmployee ?? true;
  }

  /** True when access is blocked (expired/cancelled). Null state → not blocked. */
  isExpired(): boolean {
    const s = this._state();
    return s ? !s.accessAllowed : false;
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

  /** POST /api/org/billing/create-order. */
  createOrder(body: CreatePaymentOrderRequest): Observable<CreatePaymentOrderResponse> {
    return this.api.post<ApiResponse<CreatePaymentOrderResponse>>('/org/billing/create-order', body, ORG_SCOPE)
      .pipe(map(res => res.data));
  }

  /** POST /api/org/billing/verify-payment — refresh cached state on success. */
  verifyPayment(body: VerifyPaymentRequest): Observable<VerifyPaymentResponse> {
    return this.api.post<ApiResponse<VerifyPaymentResponse>>('/org/billing/verify-payment', body, ORG_SCOPE)
      .pipe(
        map(res => res.data),
        tap(res => { if (res?.success) this.load(); }),
      );
  }
}
