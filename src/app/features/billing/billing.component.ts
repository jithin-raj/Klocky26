import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AppStateService } from '../../core/services/app-state.service';
import { OrgNavigationService } from '../../core/services/org-navigation.service';
import { ToastService } from '../../shared/components/ui-toast/toast.service';
import {
  PlanDto, AddonDto, BillingCycle, CreatePaymentOrderRequest, CreatePaymentOrderResponse,
} from '../../core/models/subscription.model';
import { loadRazorpay, createRazorpay } from '../../core/utils/razorpay.util';

@Component({
  selector: 'app-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  private readonly subscription = inject(SubscriptionService);
  private readonly appState = inject(AppStateService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);

  // ── Live subscription state (source of truth) ─────────────────────────────
  readonly sub = this.subscription.state;

  // ── Plans catalogue ───────────────────────────────────────────────────────
  plans   = signal<PlanDto[]>([]);
  addons  = signal<AddonDto[]>([]);
  extraSeatMonthlyPrice = signal(0);
  currency = signal('INR');
  loadingPlans = signal(true);
  plansError = signal('');

  // ── Picker state ──────────────────────────────────────────────────────────
  billingCycle  = signal<BillingCycle>('monthly');
  selectedPlan  = signal<string | null>(null);
  selectedAddons = signal<Set<string>>(new Set());
  extraSeats    = signal(0);
  paying        = signal(false);

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
        // Preselect the current plan if the org already has one.
        const current = this.sub()?.plan;
        this.selectedPlan.set(current ?? res.plans?.[0]?.code ?? null);
        this.loadingPlans.set(false);
      },
      error: (err) => {
        this.loadingPlans.set(false);
        this.plansError.set(err?.error?.error ?? err?.error?.message ?? 'Could not load plans.');
      },
    });
  }

  // ── Picker interactions ───────────────────────────────────────────────────
  setCycle(c: BillingCycle): void { this.billingCycle.set(c); }
  selectPlan(code: string): void { this.selectedPlan.set(code); }

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

  // ── Razorpay checkout ─────────────────────────────────────────────────────
  async pay(): Promise<void> {
    const planCode = this.selectedPlan();
    if (!planCode || this.paying() || !this.planFits()) return;
    this.paying.set(true);

    const req: CreatePaymentOrderRequest = {
      planCode,
      billingCycle: this.billingCycle(),
      addons: [...this.selectedAddons()],
      extraSeats: this.extraSeats(),
    };

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
                this.subscription.load();      // drop the block / refresh state
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
}
