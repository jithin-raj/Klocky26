import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AppStateService } from '../../core/services/app-state.service';
import { OrgNavigationService } from '../../core/services/org-navigation.service';
import { ToastService } from '../../shared/components/ui-toast/toast.service';
import { ModalService } from '../../shared/components/ui-modal/modal.service';
import { LocalizationService } from '../../core/services/localization.service';
import { UiToggleComponent } from '../../shared/components/ui-toggle/ui-toggle.component';
import {
  PlanDto, AddonDto, BillingCycle, CreatePaymentOrderRequest, CreatePaymentOrderResponse,
  BillingRecommendation, QuoteResponse, QuoteLineItem, CreateSubscriptionRequest,
  CreateSubscriptionResponse,
} from '../../core/models/subscription.model';
import { loadRazorpay, createRazorpay, RazorpaySubscriptionHandlerResponse, KLOCK_LOGO_URL } from '../../core/utils/razorpay.util';
import { OrgDateOnlyPipe } from '../../shared/pipes/localization.pipes';

@Component({
  selector: 'app-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiToggleComponent, OrgDateOnlyPipe],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  private readonly subscription = inject(SubscriptionService);
  private readonly appState = inject(AppStateService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);
  private readonly loc = inject(LocalizationService);

  // ── Live subscription state (source of truth) ─────────────────────────────
  readonly sub = this.subscription.state;
  /** Drives the "expired — renew to continue" banner + dims the picker below it. */
  readonly isExpired = this.subscription.isExpiredNow;

  // ── Plans catalogue ───────────────────────────────────────────────────────
  plans   = signal<PlanDto[]>([]);
  addons  = signal<AddonDto[]>([]);
  extraSeatMonthlyPrice = signal(0);

  /**
   * Add-ons the currently-selected plan doesn't already include. If a plan bundles
   * a feature (e.g. geofencing), its add-on is redundant, so hide it from the
   * selection area — you can't pay twice for the same capability.
   */
  readonly visibleAddons = computed(() => {
    const planFeatures = new Set((this.selectedPlanObj()?.features ?? []).map(f => f.toLowerCase()));
    return this.addons().filter(a => !planFeatures.has((a.feature ?? '').toLowerCase()));
  });
  currency = signal('INR');
  loadingPlans = signal(true);
  plansError = signal('');

  // ── Recommendation (cheapest plan covering current usage) ──────────────────
  recommendation = signal<BillingRecommendation | null>(null);
  /** True when something the org uses isn't offered by any plan/add-on. */
  readonly hasUnofferedFeature = computed(() => this.recommendation()?.allFeaturesCovered === false);

  // ── Picker state ──────────────────────────────────────────────────────────
  billingCycle  = signal<BillingCycle>('monthly');
  selectedPlan  = signal<string | null>(null);
  selectedAddons = signal<Set<string>>(new Set());
  extraSeats    = signal(0);
  paying        = signal(false);

  // ── Live quote (server-authoritative itemised price) ───────────────────────
  quote = signal<QuoteResponse | null>(null);
  quoteLoading = signal(false);

  // ── Auto-renew (Razorpay recurring subscription) ────────────────────────────
  /**
   * Local mirror of `sub()?.autoRenewEnabled`, kept in sync by the effect below
   * but writable so the toggle can reflect an optimistic change immediately and
   * be explicitly reverted on cancel/failure (a plain computed off `sub()`
   * wouldn't resync the child ui-toggle's own internal flip on revert, since
   * "setting it back to the same value" isn't a detectable change).
   */
  autoRenewDisplay = signal(false);
  autoRenewBusy = signal(false);
  /** Hidden entirely if any auto-renew call comes back 403 (not a billing admin). */
  autoRenewVisible = signal(true);
  /** Hosted Razorpay authorization link — shown if the Checkout widget fails to open. */
  autoRenewFallbackUrl = signal<string | null>(null);

  /** The current selection as a quote/order request (null until a plan is picked). */
  private readonly quoteReq = computed<CreatePaymentOrderRequest | null>(() => {
    const plan = this.selectedPlan();
    if (!plan) return null;
    return {
      planCode: plan,
      billingCycle: this.billingCycle(),
      addons: [...this.selectedAddons()].sort(),
      extraSeats: this.extraSeats(),
    };
  });

  constructor() {
    // Re-quote (debounced) on every selection change so the price + featuresLost
    // stay authoritative as the user edits. Degrades to the client estimate if
    // the endpoint is unavailable.
    toObservable(this.quoteReq).pipe(
      debounceTime(280),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((req) => {
        if (!req) { this.quote.set(null); return of(null); }
        this.quoteLoading.set(true);
        return this.subscription.getQuote(req).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    ).subscribe((q) => {
      this.quote.set(q);
      this.quoteLoading.set(false);
    });

    // Keep the toggle's display in sync with server truth whenever fresh
    // state loads (initial load, after payment, after cancel-auto-renew).
    // In-flight optimistic writes (see onAutoRenewToggle) happen between
    // these syncs and get overwritten here once the server confirms.
    effect(() => {
      const s = this.sub();
      if (s) this.autoRenewDisplay.set(!!s.autoRenewEnabled);
    });
  }

  ngOnInit(): void {
    this.subscription.load();
    this.loadPlans();
  }

  loadPlans(): void {
    this.loadingPlans.set(true);
    this.plansError.set('');
    this.subscription.getPlans().subscribe({
      next: (res) => {
        this.plans.set(res.plans ?? []);
        this.addons.set(res.addons ?? []);
        this.extraSeatMonthlyPrice.set(res.extraSeatMonthlyPrice ?? 0);
        this.currency.set(res.currency ?? 'INR');
        // Fallback pre-selection: current plan, else the first plan. The
        // recommendation below overrides this once it resolves.
        const current = this.sub()?.plan;
        this.selectedPlan.set(current ?? res.plans?.[0]?.code ?? null);
        this.loadingPlans.set(false);
        this.loadRecommendation();
      },
      error: (err) => {
        this.loadingPlans.set(false);
        this.plansError.set(err?.error?.error ?? err?.error?.message ?? 'Could not load plans.');
      },
    });
  }

  /**
   * Pre-select the cheapest plan+add-ons+seats that covers what the org already
   * uses, so the trial→paid step is one click. Degrades silently if the endpoint
   * isn't available (keeps the current/first-plan fallback from loadPlans).
   */
  private loadRecommendation(): void {
    this.subscription.getRecommendation().subscribe({
      next: (rec) => {
        if (!rec?.planCode) return;
        this.recommendation.set(rec);
        // Only apply if the recommended plan actually exists in the catalogue.
        if (!this.plans().some(p => p.code === rec.planCode)) return;
        this.selectedPlan.set(rec.planCode);
        this.extraSeats.set(Math.max(0, rec.extraSeats ?? 0));
        // Keep only recommended add-ons the selected plan doesn't already bundle.
        const planFeatures = new Set((this.plans().find(p => p.code === rec.planCode)?.features ?? []).map(f => f.toLowerCase()));
        const next = new Set<string>();
        for (const code of rec.addons ?? []) {
          const addon = this.addons().find(a => a.code === code);
          if (addon && !planFeatures.has((addon.feature ?? '').toLowerCase())) next.add(code);
        }
        this.selectedAddons.set(next);
      },
      error: () => { /* endpoint may not be deployed yet — keep the fallback */ },
    });
  }

  // ── Picker interactions ───────────────────────────────────────────────────
  setCycle(c: BillingCycle): void { this.billingCycle.set(c); }
  selectPlan(code: string): void {
    this.selectedPlan.set(code);
    const planFeatures = new Set((this.plans().find(p => p.code === code)?.features ?? []).map(f => f.toLowerCase()));
    // Features actually active on the org right now (e.g. a geofencing add-on
    // already paid for) — used below to restore, not just drop, selections.
    const activeFeatures = new Set((this.sub()?.features ?? []).map(f => f.toLowerCase()));
    const isCurrentPlan = code === this.sub()?.plan;

    this.selectedAddons.update((set) => {
      const next = new Set(set);
      for (const a of this.addons()) {
        const feature = (a.feature ?? '').toLowerCase();
        if (planFeatures.has(feature)) {
          // Bundled by the newly-picked plan — buying the add-on would be redundant.
          next.delete(a.code);
        } else if (isCurrentPlan && activeFeatures.has(feature)) {
          // Back on the org's actual current plan — restore add-ons that are
          // genuinely active, even if browsing other plans dropped them.
          next.add(a.code);
        }
      }
      return next;
    });
  }

  toggleAddon(code: string): void {
    this.selectedAddons.update((set) => {
      const next = new Set(set);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }
  isAddonSelected(code: string): boolean { return this.selectedAddons().has(code); }

  setExtraSeats(v: number): void {
    this.extraSeats.set(Math.max(0, Math.floor(Number(v) || 0)));
  }

  // ── Live estimate (server recomputes authoritatively at checkout) ─────────
  // estimate = (planMonthly + Σ addonMonthly + extraSeats×extraSeatMonthly)
  //            × (annual ? 10 : 1)   — annual = 2 months free.
  readonly estimate = computed(() => {
    const plan = this.plans().find(p => p.code === this.selectedPlan());
    const planPrice = plan?.monthlyPrice ?? 0;
    const addonTotal = this.addons()
      .filter(a => this.selectedAddons().has(a.code))
      .reduce((sum, a) => sum + a.monthlyPrice, 0);
    const seatTotal = this.extraSeats() * this.extraSeatMonthlyPrice();
    const monthly = planPrice + addonTotal + seatTotal;
    return this.billingCycle() === 'annual' ? monthly * 10 : monthly;
  });

  readonly selectedPlanObj = computed(() =>
    this.plans().find(p => p.code === this.selectedPlan()) ?? null);

  // ── Order summary (prefers the server quote; falls back to client estimate) ─
  readonly summaryLines = computed<QuoteLineItem[]>(() => {
    const q = this.quote();
    if (q?.lineItems?.length) return q.lineItems;
    // Fallback breakdown while the quote loads or if the endpoint is unavailable.
    const lines: QuoteLineItem[] = [];
    const plan = this.selectedPlanObj();
    if (plan) lines.push({ label: plan.name, amount: this.planPrice(plan) });
    for (const a of this.visibleAddons()) {
      if (this.isAddonSelected(a.code)) lines.push({ label: a.name, amount: this.addonPrice(a) });
    }
    if (this.extraSeats() > 0) {
      const seat = this.extraSeats() * this.extraSeatMonthlyPrice() * (this.billingCycle() === 'annual' ? 10 : 1);
      lines.push({ label: `${this.extraSeats()} extra seat${this.extraSeats() === 1 ? '' : 's'}`, amount: seat });
    }
    return lines;
  });
  readonly summaryTotal = computed(() => this.quote()?.total ?? this.estimate());
  readonly featuresLost = computed(() => this.quote()?.featuresLost ?? []);
  readonly featuresLostLabels = computed(() => this.featuresLost().map(f => this.featureLabel(f)));

  // ── Downgrade / capacity validation ───────────────────────────────────────
  // A plan can't be chosen if it can't hold the org's *current* usage. Employee
  // capacity can be topped up with extra seats; admin capacity can't (you'd have
  // to remove admins), so an admin overflow is a hard block. Server enforces
  // this too — this just guides the choice.
  readonly currentEmployees = computed(() => this.sub()?.usage.employees ?? 0);
  readonly currentAdmins    = computed(() => this.sub()?.usage.admins ?? 0);

  /** Employees the selected plan covers, incl. the extra seats being purchased. */
  readonly selectedEmpCapacity = computed(() => {
    const cap = this.selectedPlanObj()?.maxEmployees;
    return cap == null ? Infinity : cap + this.extraSeats();
  });

  /** Extra seats still needed for the current headcount (0 if it fits). */
  readonly seatShortfall = computed(() =>
    Math.max(0, this.currentEmployees() - this.selectedEmpCapacity()));

  /** Admins over the selected plan's admin cap (can't be covered by seats). */
  readonly adminShortfall = computed(() => {
    const cap = this.selectedPlanObj()?.maxAdmins;
    return cap == null ? 0 : Math.max(0, this.currentAdmins() - cap);
  });

  readonly planFits = computed(() => this.seatShortfall() === 0 && this.adminShortfall() === 0);

  // ── Checkout CTA — only actionable when the selection actually differs from
  // what the org already pays for, or when a manual renewal is due. Merely
  // having an active plan with the current plan still selected shouldn't
  // invite a "Renew / Change plan" click — there's nothing to change yet.
  /** True if the picker differs from the org's current plan/seats/add-ons. */
  readonly hasPendingChange = computed(() => {
    const s = this.sub();
    if (this.selectedPlan() !== s?.plan) return true;
    if (this.extraSeats() > 0) return true;
    const activeFeatures = new Set((s?.features ?? []).map(f => f.toLowerCase()));
    for (const code of this.selectedAddons()) {
      const addon = this.addons().find(a => a.code === code);
      if (addon && !activeFeatures.has((addon.feature ?? '').toLowerCase())) return true;
    }
    return false;
  });
  /** Renewal window even with no changes selected — only matters if auto-renew won't cover it. */
  readonly nearExpiry = computed(() => {
    const d = this.sub()?.daysLeft;
    return d != null && d <= 14;
  });
  readonly canCheckout = computed(() => {
    if (!this.selectedPlan() || this.paying() || !this.planFits()) return false;
    const s = this.sub();
    if (!s || s.status !== 'active') return true;
    if (this.hasPendingChange()) return true;
    return this.nearExpiry() && !s.autoRenewEnabled;
  });
  readonly checkoutLabel = computed(() => {
    if (this.paying()) return 'Starting…';
    const s = this.sub();
    if (!s || s.status !== 'active') return 'Subscribe';
    if (this.selectedPlan() !== s.plan) return 'Change Plan';
    if (this.hasPendingChange()) return 'Update Plan';
    if (this.nearExpiry() && !s.autoRenewEnabled) return 'Renew Now';
    return 'Current Plan';
  });

  /** True when a plan can't even hold current employees at 0 extra seats (card badge). */
  planTooSmall(p: PlanDto): boolean {
    return p.maxEmployees != null && p.maxEmployees < this.currentEmployees();
  }

  /** One-click: bump extra seats to exactly cover the employee shortfall. */
  addSeatsToFit(): void {
    const need = this.seatShortfall();
    if (need > 0) this.extraSeats.update(v => v + need);
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  planPrice(p: PlanDto): number {
    return this.billingCycle() === 'annual' ? p.annualPrice : p.monthlyPrice;
  }

  addonPrice(a: AddonDto): number {
    return this.billingCycle() === 'annual' ? a.annualPrice : a.monthlyPrice;
  }

  fmt(amount: number): string {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: this.currency() || 'INR', maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${this.currency()} ${amount}`;
    }
  }

  usagePct(used: number, limit: number | null): number {
    if (limit == null || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  limitLabel(limit: number | null): string {
    return limit == null ? '∞' : String(limit);
  }

  statusLabel(status: string | undefined): string {
    return {
      trial: 'Trial', active: 'Active', expired: 'Expired', cancelled: 'Cancelled',
    }[status ?? ''] ?? (status ?? '—');
  }

  statusClass(status: string | undefined): string {
    return {
      trial: 'bl-status--trial', active: 'bl-status--active',
      expired: 'bl-status--expired', cancelled: 'bl-status--cancelled',
    }[status ?? ''] ?? 'bl-status--trial';
  }

  featureLabel(code: string): string {
    return code.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Fetch an authoritative quote and, if the chosen selection drops features the
   * org currently uses, show a confirmation. Returns true to proceed to checkout,
   * false if the user cancels. A failed/absent quote endpoint resolves to true so
   * checkout is never blocked on it (server reconciles entitlements on payment).
   */
  private async confirmQuote(planCode: string): Promise<boolean> {
    let featuresLost: string[] = [];
    try {
      const quote = await firstValueFrom(this.subscription.getQuote({
        planCode,
        billingCycle: this.billingCycle(),
        addons: [...this.selectedAddons()],
        extraSeats: this.extraSeats(),
      }));
      featuresLost = quote?.featuresLost ?? [];
    } catch {
      return true; // quote unavailable — don't block checkout
    }

    if (!featuresLost.length) return true;

    const labels = featuresLost.map(f => this.featureLabel(f));
    const list = labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
    const planName = this.selectedPlanObj()?.name ?? 'this plan';
    return this.modal.confirm({
      title: 'Confirm plan change',
      message: `${list} will be disabled — ${labels.length === 1 ? "it's" : "they're"} not included in ${planName}. Continue?`,
      confirmLabel: 'Continue',
      variant: 'danger',
    });
  }

  // ── Razorpay checkout ─────────────────────────────────────────────────────
  async pay(): Promise<void> {
    const planCode = this.selectedPlan();
    if (!planCode || !this.canCheckout()) return;
    this.paying.set(true);

    const req: CreatePaymentOrderRequest = {
      planCode,
      billingCycle: this.billingCycle(),
      addons: [...this.selectedAddons()],
      extraSeats: this.extraSeats(),
    };

    // Quote first: warn before a downgrade that would disable features the org
    // currently uses. If the quote endpoint isn't available, degrade gracefully
    // and continue (the server still reconciles entitlements on payment).
    if (!(await this.confirmQuote(planCode))) {
      this.paying.set(false);
      return;
    }

    try {
      const order = await new Promise<CreatePaymentOrderResponse>((resolve, reject) => {
        this.subscription.createOrder(req).subscribe({ next: resolve, error: reject });
      });
      await loadRazorpay();

      const user = this.appState.user();
      const rzp = createRazorpay({
        key: order.razorpayKeyId,
        order_id: order.gatewayOrderId,
        amount: order.amount * 100,       // Razorpay wants paise
        currency: order.currency,
        name: 'Klock',
        image: KLOCK_LOGO_URL,
        description: `${planCode} · ${this.billingCycle()}`,
        prefill: { name: user?.fullName ?? '', email: user?.email ?? '' },
        theme: { color: user?.accentColor ?? '#6366f1' },
        handler: (resp) => {
          this.subscription.verifyPayment({
            razorpayOrderId: resp.razorpay_order_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            razorpaySignature: resp.razorpay_signature,
          }).subscribe({
            next: (v) => {
              this.paying.set(false);
              if (v.success) {
                this.toast.success('Payment successful', 'Your subscription is now active.');
                // Unblock synchronously BEFORE navigating — otherwise the
                // subscriptionGuard would still see the old "expired" flag on
                // this very navigation and bounce straight back to /billing.
                this.subscription.setExpired(false);
                this.subscription.load();      // refresh full state (features, limits, etc.)
                this.orgNav.navigate(['app', 'dashboard']);
              } else {
                this.toast.error('Payment not verified', 'Please contact support if you were charged.');
              }
            },
            error: (err) => {
              this.paying.set(false);
              this.toast.error('Verification failed', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
            },
          });
        },
        modal: { ondismiss: () => this.paying.set(false) },
      });
      rzp.open();
    } catch (err: any) {
      this.paying.set(false);
      this.toast.error('Could not start checkout', err?.error?.error ?? err?.error?.message ?? err?.message ?? 'Please try again.');
    }
  }

  // ── Auto-renew (Razorpay recurring subscription) ────────────────────────────

  /** Toggle interaction — accepts the click optimistically, then runs the real flow. */
  onAutoRenewToggle(next: boolean): void {
    if (this.autoRenewBusy()) {
      this.autoRenewDisplay.set(!next);   // ignore a double-click mid-flight, snap back
      return;
    }
    if (next) {
      this.autoRenewDisplay.set(true);
      this.startAutoRenew();
    } else {
      // Snap back to ON immediately — it stays visually ON through the confirm
      // dialog and the API call, only flipping OFF once cancel-auto-renew succeeds.
      this.autoRenewDisplay.set(true);
      this.confirmAndCancelAutoRenew();
    }
  }

  /**
   * ENABLE flow — used by both the toggle (status === 'active') and the
   * "Turn on auto-renew" CTA (trial/expired/cancelled). Uses whatever plan/
   * cycle/add-ons/seats are currently selected in the picker above.
   */
  async startAutoRenew(): Promise<void> {
    if (this.autoRenewBusy()) return;
    const planCode = this.selectedPlan();
    if (!planCode) {
      this.toast.error('Choose a plan', 'Pick a plan below before turning on auto-renew.');
      this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
      return;
    }
    this.autoRenewBusy.set(true);
    this.autoRenewFallbackUrl.set(null);

    // Quote first: warn before a downgrade that would disable features the org
    // currently uses.
    if (!(await this.confirmQuote(planCode))) {
      this.autoRenewBusy.set(false);
      this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
      return;
    }

    const req: CreateSubscriptionRequest = {
      planCode,
      billingCycle: this.billingCycle(),
      addons: [...this.selectedAddons()],
      extraSeats: this.extraSeats(),
    };

    let res: CreateSubscriptionResponse;
    try {
      res = await firstValueFrom(this.subscription.createSubscription(req));
    } catch (err: any) {
      this.autoRenewBusy.set(false);
      this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
      if (err?.status === 403) { this.autoRenewVisible.set(false); return; }
      this.toast.error('Could not start auto-renew', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      return;
    }

    // Hosted fallback link, in case the Checkout widget below can't open.
    this.autoRenewFallbackUrl.set(res.shortUrl || null);

    try {
      await loadRazorpay();
      const user = this.appState.user();
      const rzp = createRazorpay({
        key: res.razorpayKeyId,
        subscription_id: res.subscriptionId,
        name: 'Klock',
        image: KLOCK_LOGO_URL,
        description: `${res.planCode} (${res.billingCycle}) auto-renew`,
        prefill: { name: user?.fullName ?? '', email: user?.email ?? '' },
        theme: { color: user?.accentColor ?? '#6366f1' },
        handler: (resp) => this.onSubscriptionVerifyHandler(resp),
        modal: {
          ondismiss: () => {
            this.autoRenewBusy.set(false);
            this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
            this.toast.info('Subscription not completed', '');
          },
        },
      });
      rzp.open();
    } catch {
      this.autoRenewBusy.set(false);
      this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
      this.toast.error('Could not open checkout', 'Use the authorization link below to complete setup.');
    }
  }

  private onSubscriptionVerifyHandler(resp: RazorpaySubscriptionHandlerResponse): void {
    this.subscription.verifySubscription({
      razorpaySubscriptionId: resp.razorpay_subscription_id,
      razorpayPaymentId: resp.razorpay_payment_id,
      razorpaySignature: resp.razorpay_signature,
    }).subscribe({
      next: (v) => {
        this.autoRenewBusy.set(false);
        this.autoRenewFallbackUrl.set(null);
        if (v.success) {
          this.toast.success('Auto-renew is on', 'Your plan renews automatically.');
          this.autoRenewDisplay.set(v.autoRenewEnabled ?? true);
          // Payment succeeded — unblock synchronously in case we were expired,
          // same reasoning as the one-time pay() flow above.
          this.subscription.setExpired(false);
          this.subscription.load();
        } else {
          this.toast.error('Payment not verified', 'Please contact support if you were charged.');
          this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
        }
      },
      error: (err) => {
        this.autoRenewBusy.set(false);
        this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? false);
        this.toast.error('Verification failed', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  /** DISABLE flow — confirm, then cancel-auto-renew; toggle stays ON until it succeeds. */
  private async confirmAndCancelAutoRenew(): Promise<void> {
    const expiresAt = this.sub()?.subscriptionExpiresAt;
    const when = expiresAt
      ? this.loc.formatDateOnly(expiresAt)
      : 'the end of your current period';

    const ok = await this.modal.confirm({
      title: 'Turn off auto-renew?',
      message: `You'll keep full access until ${when}, then it stops renewing.`,
      confirmLabel: 'Turn off auto-renew',
      variant: 'danger',
    });
    if (!ok) return; // toggle is already showing ON — nothing to revert

    this.autoRenewBusy.set(true);
    this.subscription.cancelAutoRenew().subscribe({
      next: (res) => {
        this.autoRenewBusy.set(false);
        this.autoRenewDisplay.set(false);
        this.toast.info('Auto-renew updated', res?.message || 'Auto-renew has been turned off.');
      },
      error: (err) => {
        this.autoRenewBusy.set(false);
        this.autoRenewDisplay.set(this.sub()?.autoRenewEnabled ?? true); // revert — stays ON
        if (err?.status === 403) { this.autoRenewVisible.set(false); return; }
        this.toast.error('Could not update', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }
}
