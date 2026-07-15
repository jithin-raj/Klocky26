import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformCatalogService } from '../../../../core/services/platform-catalog.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  CatalogPlan, CatalogAddon, PlanUpsertRequest, AddonUpsertRequest,
} from '../../../../core/models/platform-catalog.model';
import { FEATURE_CODES, FEATURE_LABELS } from '../../../../core/models/subscription.model';

interface PlanForm {
  code: string; name: string; description: string;
  maxEmployees: number | null; maxAdmins: number | null;
  monthlyPrice: number; features: Set<string>; isActive: boolean; sortOrder: number;
}
interface AddonForm {
  code: string; name: string; feature: string;
  monthlyPrice: number; isActive: boolean; sortOrder: number;
}

@Component({
  selector: 'app-admin-catalog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-catalog.component.html',
  styleUrl: './admin-catalog.component.scss',
})
export class AdminCatalogComponent implements OnInit {
  private readonly catalogSvc = inject(PlatformCatalogService);
  private readonly toast = inject(ToastService);

  readonly featureCodes = FEATURE_CODES;
  readonly featureLabels = FEATURE_LABELS;

  plans  = signal<CatalogPlan[]>([]);
  addons = signal<CatalogAddon[]>([]);
  currency = signal('INR');
  extraSeatMonthlyPrice = signal(0);
  trialDays = signal(0);
  loading = signal(true);
  error = signal('');
  busy = signal(false);

  // ── Editor state ──────────────────────────────────────────────────────────
  planOpen  = signal(false);
  planEditCode = signal<string | null>(null);   // null = creating
  planForm: PlanForm = this.blankPlan();

  addonOpen = signal(false);
  addonEditCode = signal<string | null>(null);
  addonForm: AddonForm = this.blankAddon();

  syncing = signal(false);

  ngOnInit(): void { this.load(); }

  /**
   * Reset the whole catalogue to the shipped defaults (repriced plans/add-ons,
   * retired ones deactivated). Bulk overwrite — confirm first.
   */
  syncDefaults(): void {
    if (this.syncing() || this.busy()) return;
    if (!window.confirm('Reset every plan and add-on to the shipped defaults? This overwrites current names, prices, caps and features, and deactivates retired items.')) return;
    this.syncing.set(true);
    this.catalogSvc.syncDefaults().subscribe({
      next: () => {
        this.syncing.set(false);
        this.toast.success('Catalogue synced', 'Plans and add-ons reset to the latest defaults.');
        this.load();
      },
      error: (err) => {
        this.syncing.set(false);
        this.toast.error('Could not sync defaults', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.catalogSvc.getCatalog().subscribe({
      next: (res) => {
        this.plans.set([...(res.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder));
        this.addons.set([...(res.addons ?? [])].sort((a, b) => a.sortOrder - b.sortOrder));
        this.currency.set(res.currency ?? 'INR');
        this.extraSeatMonthlyPrice.set(res.extraSeatMonthlyPrice ?? 0);
        this.trialDays.set(res.trialDays ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.error?.message ?? 'Could not load catalog.');
      },
    });
  }

  fmt(amount: number): string {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: this.currency() || 'INR', maximumFractionDigits: 0 }).format(amount);
    } catch { return `${this.currency()} ${amount}`; }
  }

  featureLabel(code: string): string { return this.featureLabels[code] ?? code; }
  capLabel(v: number | null): string { return v == null ? '∞' : String(v); }

  // ── Plan editor ─────────────────────────────────────────────────────────────
  private blankPlan(): PlanForm {
    return { code: '', name: '', description: '', maxEmployees: null, maxAdmins: null, monthlyPrice: 0, features: new Set(), isActive: true, sortOrder: 0 };
  }

  openNewPlan(): void {
    this.planEditCode.set(null);
    this.planForm = this.blankPlan();
    this.planForm.sortOrder = this.plans().length;
    this.planOpen.set(true);
  }

  openEditPlan(p: CatalogPlan): void {
    this.planEditCode.set(p.code);
    this.planForm = {
      code: p.code, name: p.name, description: p.description,
      maxEmployees: p.maxEmployees, maxAdmins: p.maxAdmins,
      monthlyPrice: p.monthlyPrice, features: new Set(p.features ?? []),
      isActive: p.isActive, sortOrder: p.sortOrder,
    };
    this.planOpen.set(true);
  }

  closePlan(): void { this.planOpen.set(false); }

  togglePlanFeature(code: string): void {
    this.planForm.features.has(code) ? this.planForm.features.delete(code) : this.planForm.features.add(code);
  }
  hasPlanFeature(code: string): boolean { return this.planForm.features.has(code); }

  get planValid(): boolean {
    return !!this.planForm.name.trim() && (this.planEditCode() !== null || !!this.planForm.code.trim());
  }

  savePlan(): void {
    if (!this.planValid || this.busy()) return;
    this.busy.set(true);
    const body: PlanUpsertRequest = {
      name: this.planForm.name.trim(),
      description: this.planForm.description.trim(),
      maxEmployees: this.planForm.maxEmployees,
      maxAdmins: this.planForm.maxAdmins,
      monthlyPrice: this.planForm.monthlyPrice ?? 0,
      features: [...this.planForm.features],
      isActive: this.planForm.isActive,
      sortOrder: this.planForm.sortOrder ?? 0,
    };
    const editCode = this.planEditCode();
    const req$ = editCode
      ? this.catalogSvc.updatePlan(editCode, body)
      : this.catalogSvc.createPlan({ ...body, code: this.planForm.code.trim() });

    req$.subscribe({
      next: () => {
        this.busy.set(false);
        this.planOpen.set(false);
        this.toast.success(editCode ? 'Plan updated' : 'Plan created', body.name);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error('Could not save plan', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  togglePlanActive(p: CatalogPlan): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.catalogSvc.updatePlan(p.code, {
      name: p.name, description: p.description, maxEmployees: p.maxEmployees, maxAdmins: p.maxAdmins,
      monthlyPrice: p.monthlyPrice, features: p.features, isActive: !p.isActive, sortOrder: p.sortOrder,
    }).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => { this.busy.set(false); this.toast.error('Could not update plan', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  deletePlan(p: CatalogPlan): void {
    if (this.busy()) return;
    if (!window.confirm(`Delete plan "${p.name}"? This can't be undone.`)) return;
    this.busy.set(true);
    this.catalogSvc.deletePlan(p.code).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Plan deleted', p.name); this.load(); },
      error: (err) => {
        this.busy.set(false);
        // 409 = orgs are on this plan → guide to deactivate instead.
        if (err?.status === 409) {
          this.toast.error('Can\'t delete this plan', 'Organisations are still on it. Deactivate it instead — it hides from pricing but existing orgs keep working.');
        } else {
          this.toast.error('Could not delete plan', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
        }
      },
    });
  }

  // ── Add-on editor ────────────────────────────────────────────────────────────
  private blankAddon(): AddonForm {
    return { code: '', name: '', feature: FEATURE_CODES[0], monthlyPrice: 0, isActive: true, sortOrder: 0 };
  }

  openNewAddon(): void {
    this.addonEditCode.set(null);
    this.addonForm = this.blankAddon();
    this.addonForm.sortOrder = this.addons().length;
    this.addonOpen.set(true);
  }

  openEditAddon(a: CatalogAddon): void {
    this.addonEditCode.set(a.code);
    this.addonForm = { code: a.code, name: a.name, feature: a.feature, monthlyPrice: a.monthlyPrice, isActive: a.isActive, sortOrder: a.sortOrder };
    this.addonOpen.set(true);
  }

  closeAddon(): void { this.addonOpen.set(false); }

  get addonValid(): boolean {
    return !!this.addonForm.name.trim() && !!this.addonForm.feature && (this.addonEditCode() !== null || !!this.addonForm.code.trim());
  }

  saveAddon(): void {
    if (!this.addonValid || this.busy()) return;
    this.busy.set(true);
    const body: AddonUpsertRequest = {
      name: this.addonForm.name.trim(),
      feature: this.addonForm.feature,
      monthlyPrice: this.addonForm.monthlyPrice ?? 0,
      isActive: this.addonForm.isActive,
      sortOrder: this.addonForm.sortOrder ?? 0,
    };
    const editCode = this.addonEditCode();
    const req$ = editCode
      ? this.catalogSvc.updateAddon(editCode, body)
      : this.catalogSvc.createAddon({ ...body, code: this.addonForm.code.trim() });

    req$.subscribe({
      next: () => {
        this.busy.set(false);
        this.addonOpen.set(false);
        this.toast.success(editCode ? 'Add-on updated' : 'Add-on created', body.name);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error('Could not save add-on', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  toggleAddonActive(a: CatalogAddon): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.catalogSvc.updateAddon(a.code, {
      name: a.name, feature: a.feature, monthlyPrice: a.monthlyPrice, isActive: !a.isActive, sortOrder: a.sortOrder,
    }).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => { this.busy.set(false); this.toast.error('Could not update add-on', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  deleteAddon(a: CatalogAddon): void {
    if (this.busy()) return;
    if (!window.confirm(`Delete add-on "${a.name}"?`)) return;
    this.busy.set(true);
    this.catalogSvc.deleteAddon(a.code).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Add-on deleted', a.name); this.load(); },
      error: (err) => {
        this.busy.set(false);
        if (err?.status === 409) {
          this.toast.error('Can\'t delete this add-on', 'Organisations are still on it. Deactivate it instead.');
        } else {
          this.toast.error('Could not delete add-on', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
        }
      },
    });
  }
}
