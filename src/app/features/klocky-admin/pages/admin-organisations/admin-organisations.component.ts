import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PlatformAdminService } from '../../../../core/services/platform-admin.service';
import { LocalizationService } from '../../../../core/services/localization.service';
import { PlatformOrgListItem, SubscriptionStatus, OrgEmailType, UpdatePlatformOrgRequest } from '../../../../core/models/platform-auth.model';
import { FEATURE_CODES, FEATURE_LABELS } from '../../../../core/models/subscription.model';
import {
  UiSelectComponent, UiDatePickerComponent, SelectOption,
  UiDataGridComponent, GridColumn, GridAction,
  UiFormModalComponent, UiFormSectionComponent, UiFormGridComponent, UiFormFieldComponent,
  UiInputComponent, UiToggleComponent, UiConfirmDangerComponent, ToastService,
} from '../../../../shared/components';

const ORG_AVATAR_COLORS = ['#0d9488','#6366f1','#ec4899','#f59e0b','#22c55e','#8b5cf6','#0ea5e9','#ef4444'];

@Component({
  selector: 'klocky-admin-organisations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiSelectComponent, UiDatePickerComponent,
    UiDataGridComponent,
    UiFormModalComponent, UiFormSectionComponent, UiFormGridComponent, UiFormFieldComponent,
    UiInputComponent, UiToggleComponent, UiConfirmDangerComponent,
  ],
  templateUrl: './admin-organisations.component.html',
  styleUrl: './admin-organisations.component.scss',
})
export class AdminOrganisationsComponent implements OnInit {
  private readonly platformAdmin = inject(PlatformAdminService);
  private readonly toast = inject(ToastService);
  private readonly loc = inject(LocalizationService);

  readonly orgs    = signal<PlatformOrgListItem[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  readonly search             = signal('');
  readonly subscriptionFilter = signal<'all' | SubscriptionStatus>('all');

  readonly subscriptionFilterOptions: SelectOption[] = [
    { label: 'All subscriptions', value: 'all' },
    { label: 'Trial', value: 'trial' },
    { label: 'Active', value: 'active' },
    { label: 'Expired', value: 'expired' },
    { label: 'Cancelled', value: 'cancelled' },
  ];
  readonly subscriptionSelectOptions: SelectOption[] = [
    { label: 'Trial', value: 'trial' },
    { label: 'Active', value: 'active' },
    { label: 'Expired', value: 'expired' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  // ── Shared grid config ────────────────────────────────────────────
  orgInitials(o: PlatformOrgListItem) { return o.companyName.slice(0, 2).toUpperCase(); }
  orgColor(o: PlatformOrgListItem) {
    let h = 0;
    for (let i = 0; i < o.orgSlug.length; i++) h = (h * 31 + o.orgSlug.charCodeAt(i)) >>> 0;
    return ORG_AVATAR_COLORS[h % ORG_AVATAR_COLORS.length];
  }
  readonly orgTrackBy = (o: PlatformOrgListItem) => o.orgSlug;

  readonly orgColumns: GridColumn<PlatformOrgListItem>[] = [
    {
      key: 'companyName', label: 'Organisation', sortable: true, type: 'avatar',
      avatarInitials: (o) => this.orgInitials(o),
      avatarColor: (o) => this.orgColor(o),
      primaryText: (o) => o.companyName,
      secondaryText: (o) => `/${o.orgUrlName}/app`,
    },
    { key: 'primaryEmail', label: 'Admin', sortable: true, type: 'text', value: (o) => o.primaryEmail },
    { key: 'industry', label: 'Industry', type: 'text', value: (o) => o.industry || '—' },
    {
      key: 'subscriptionStatus', label: 'Subscription', type: 'badge',
      value: (o) => o.subscriptionStatus,
      badgeLabel: (v) => this.subscriptionLabel(v as SubscriptionStatus),
      badgeBg: (v) => v === 'active' ? '#dcfce7' : v === 'trial' ? '#fef9c3' : '#fee2e2',
      badgeColor: (v) => v === 'active' ? '#16a34a' : v === 'trial' ? '#b45309' : '#dc2626',
    },
    {
      key: 'isActive', label: 'Status', type: 'badge',
      value: (o) => o.isActive ? 'active' : 'deactivated',
      badgeBg: (v) => v === 'active' ? '#dcfce7' : '#fee2e2',
      badgeColor: (v) => v === 'active' ? '#16a34a' : '#dc2626',
    },
    { key: 'createdAt', label: 'Registered', sortable: true, type: 'date', value: (o) => o.createdAt },
  ];

  readonly orgActions: GridAction<PlatformOrgListItem>[] = [
    { label: 'View details', click: (o) => this.viewOrg(o) },
    { label: 'Edit', click: (o) => this.openEdit(o) },
    { label: 'Deactivate', danger: true, visible: (o) => o.isActive, click: (o) => this.toggleActive(o) },
    { label: 'Activate', visible: (o) => !o.isActive, click: (o) => this.toggleActive(o) },
    { label: 'Delete permanently', danger: true, click: (o) => this.openHardDelete(o) },
  ];

  readonly selectedOrg  = signal<PlatformOrgListItem | null>(null);

  // ── Hard delete (DELETE /api/platform/organisations/{slug}) ───────
  readonly hardDeleteTarget = signal<PlatformOrgListItem | null>(null);
  readonly hardDeleting     = signal(false);
  /** Whether to download a backup ZIP before deleting — the admin's choice, defaults to yes. */
  readonly hardDeleteWithBackup = signal(true);
  readonly hardDeleteMessage = computed(() => {
    const name = this.hardDeleteTarget()?.companyName || 'this organisation';
    const tail = `${name}, its tenant database and all payment records are permanently removed. This cannot be undone.`;
    return this.hardDeleteWithBackup()
      ? `A backup ZIP downloads to your device first, then ${tail}`
      : `No backup will be taken — ${tail}`;
  });
  readonly hardDeleteConfirmLabel = computed(() => this.hardDeleteWithBackup() ? 'Back up & delete' : 'Delete without backup');

  // ── Add organisation ─────────────────────────────────────────────
  readonly showAdd        = signal(false);
  readonly addSubmitting  = signal(false);
  readonly addError       = signal('');
  readonly addResult      = signal<{ orgSlug: string; temporaryPassword: string } | null>(null);
  newOrgCompanyName = '';
  newOrgPrimaryEmail = '';
  newOrgIndustry = '';

  // ── Edit organisation (PUT /api/platform/organisations/{slug}) ────
  readonly editingOrg     = signal<PlatformOrgListItem | null>(null);
  readonly editSubmitting = signal(false);
  readonly editError      = signal('');
  editCompanyName = '';
  editAccentColor = '';
  editIsActive = true;
  readonly subscriptionStatusOptions: SubscriptionStatus[] = ['trial', 'active', 'expired', 'cancelled'];
  editSubscriptionStatus: SubscriptionStatus = 'trial';
  editSubscriptionPlan = '';
  editTrialEndsAt = '';
  editSubscriptionExpiresAt = '';
  editMaxEmployees: number | null = null;
  editMaxAdminAccounts: number | null = null;
  editInactivityRetentionDays: number | null = null;
  /** Per-org custom feature overrides (checkbox set). */
  editFeatures = new Set<string>();

  // ── Reset org-admin password — REQUESTED endpoint, not live yet (SERVER_CHANGES_REQUEST.md §0) ──
  readonly resetPwSubmitting = signal(false);
  readonly resetPwError      = signal('');
  readonly resetPwResult     = signal('');

  // ── Rename orgUrlName — ORG_URL_NAME_INTEGRATION.md §3, Klock-admin-only ──
  readonly renameSubmitting = signal(false);
  readonly renameError      = signal('');
  editOrgUrlName = '';

  // ── Change orgSlug (login code) — Klock-admin-only; signs out current sessions ──
  readonly slugSubmitting = signal(false);
  readonly slugError      = signal('');
  editOrgSlug = '';

  // ── Database configuration — UI shell only, NOT wired to any backend.
  // No endpoint exists for this anywhere in INTEGRATION_GUIDE.md, and tenant
  // DB credentials shouldn't transit a web UI at all (see SERVER_CHANGES_REQUEST.md
  // §0) — these fields never leave the browser.
  readonly dbConfigNotice = signal('');
  dbHost = '';
  dbName = '';
  dbUsername = '';
  dbPassword = '';

  // ── Agent integration status — local biometric-sync agent per org.
  // UI shell only, no backend endpoint exists yet (SERVER_CHANGES_REQUEST.md §0).
  readonly agentStatusNotice = signal('');
  agentStatus: 'active' | 'pending' | 'inactive' = 'pending';
  readonly agentStatusOptions = [
    { label: 'Active',   value: 'active'   },
    { label: 'Pending',  value: 'pending'  },
    { label: 'Inactive', value: 'inactive' },
  ];

  // ── Send email — REQUESTED endpoint, not live yet (SERVER_CHANGES_REQUEST.md §0d) ──
  readonly emailSubmitting = signal(false);
  readonly emailError      = signal('');
  readonly emailSent       = signal('');
  emailType: OrgEmailType = 'resend_welcome';
  emailCustomSubject = '';
  emailCustomMessage = '';
  readonly emailTypeOptions = [
    { label: 'Resend Welcome Email',          value: 'resend_welcome'     },
    { label: 'Resend Verification Code',      value: 'resend_otp'         },
    { label: 'Subscription / Payment Alert',  value: 'subscription_alert' },
    { label: 'Custom Message',                value: 'custom'             },
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.platformAdmin.listOrganisations().subscribe({
      next: (res) => { this.orgs.set(res.data); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message ?? 'Could not load organisations.');
      },
    });
  }

  // ── Filtered list ─────────────────────────────────────────────
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.subscriptionFilter();
    return this.orgs().filter(o => {
      const matchQ = !q || o.companyName.toLowerCase().includes(q)
                       || o.orgSlug.includes(q)
                       || o.primaryEmail.toLowerCase().includes(q);
      const matchS = s === 'all' || o.subscriptionStatus === s;
      return matchQ && matchS;
    });
  });

  // ── Stats ─────────────────────────────────────────────────────
  readonly totalOrgs    = computed(() => this.orgs().length);
  readonly activeOrgs   = computed(() => this.orgs().filter(o => o.isActive).length);
  readonly inactiveOrgs = computed(() => this.orgs().filter(o => !o.isActive).length);
  readonly trialOrgs    = computed(() => this.orgs().filter(o => o.subscriptionStatus === 'trial').length);
  readonly expiredOrgs  = computed(() => this.orgs().filter(o => o.subscriptionStatus === 'expired' || o.subscriptionStatus === 'cancelled').length);

  // ── Actions ───────────────────────────────────────────────────
  viewOrg(org: PlatformOrgListItem): void {
    // Show the list row immediately, then refresh from the single-org endpoint.
    this.selectedOrg.set(org);
    this.platformAdmin.getOrganisation(org.orgSlug).subscribe({
      next: (res) => {
        const fresh = this.mergeOrg(org, res.data);
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? fresh : o));
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(fresh);
      },
      error: () => { /* keep the list row's data */ },
    });
  }
  closeDetail(): void { this.selectedOrg.set(null); }

  /**
   * The summary response (OrganizationSummaryResponse) omits `features` and
   * `industry`, so a raw replace would blank them. Merge onto the existing row,
   * keeping locally-known values the API didn't echo back.
   */
  private mergeOrg(existing: PlatformOrgListItem, patch: PlatformOrgListItem): PlatformOrgListItem {
    return {
      ...existing,
      ...patch,
      features: patch.features ?? existing.features,
      industry: patch.industry ?? existing.industry,
    };
  }

  /** Maps to PUT .../organisations/{slug} { isActive } — there's no separate "suspend" endpoint. */
  toggleActive(org: PlatformOrgListItem): void {
    const nextActive = !org.isActive;
    this.platformAdmin.updateOrganisation(org.orgSlug, { isActive: nextActive }).subscribe({
      next: (res) => {
        const merged = this.mergeOrg(org, res.data);
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? merged : o));
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(merged);
      },
    });
  }

  // ── Hard delete (irreversible; type-to-confirm) ───────────────
  openHardDelete(org: PlatformOrgListItem): void {
    this.hardDeleteWithBackup.set(true);   // reset to the safe default each time the dialog opens
    this.hardDeleteTarget.set(org);
  }

  cancelHardDelete(): void {
    if (this.hardDeleting()) return;
    this.hardDeleteTarget.set(null);
  }

  /**
   * Backup is the admin's choice (checkbox in the dialog): if wanted, download
   * the ZIP first — while the org still exists, since the tenant DB is gone
   * right after delete — and abort without deleting if that download fails.
   * If NOT wanted, skip the backup call entirely and delete straight away.
   * Either way, `skipBackup=true` on the delete call itself: the backup this
   * screen offers is the dedicated /backup endpoint above, not the delete
   * endpoint's own redundant server-side copy.
   */
  async doHardDelete(): Promise<void> {
    const org = this.hardDeleteTarget();
    if (!org || this.hardDeleting()) return;
    this.hardDeleting.set(true);

    if (this.hardDeleteWithBackup()) {
      // Download the backup ZIP (one JSON per table + README) before deleting.
      try {
        const res = await firstValueFrom(this.platformAdmin.backupOrganisation(org.orgSlug));
        this.triggerDownload(res, `${org.orgSlug}-backup.zip`);
      } catch (err) {
        this.hardDeleting.set(false);
        this.toast.error('Backup failed — nothing was deleted', await this.extractBlobError(err));
        return;
      }
    }

    this.platformAdmin.deleteOrganisation(org.orgSlug, true).subscribe({
      next: (res) => {
        this.hardDeleting.set(false);
        this.hardDeleteTarget.set(null);
        this.orgs.update(list => list.filter(o => o.orgSlug !== org.orgSlug));
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(null);
        if (this.editingOrg()?.orgSlug === org.orgSlug) this.editingOrg.set(null);
        this.toast.success(
          `${org.companyName} deleted`,
          res.message || (this.hardDeleteWithBackup()
            ? 'Backup downloaded; the organisation and its data were removed.'
            : 'The organisation and its data were removed — no backup was taken.'),
        );
      },
      error: (err) => {
        this.hardDeleting.set(false);
        if (err?.status === 404) {
          this.hardDeleteTarget.set(null);
          this.orgs.update(list => list.filter(o => o.orgSlug !== org.orgSlug));
          this.toast.error('Organisation not found', 'It may have already been deleted.');
        } else {
          this.toast.error('Could not delete organisation', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
        }
      },
    });
  }

  /** Save a binary response to disk, using the Content-Disposition filename when present. */
  private triggerDownload(res: HttpResponse<Blob>, fallbackName: string): void {
    const body = res.body;
    if (!body) return;
    const filename = this.filenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackName;
    const url = URL.createObjectURL(body);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private filenameFromDisposition(cd: string | null): string | null {
    if (!cd) return null;
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
    if (star) { try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { /* fall through */ } }
    const plain = /filename="?([^";]+)"?/i.exec(cd);
    return plain ? plain[1].trim() : null;
  }

  /** Blob error responses carry the JSON body as a Blob — read it to surface { error }. */
  private async extractBlobError(err: unknown): Promise<string> {
    const body = (err as { error?: unknown })?.error;
    if (body instanceof Blob) {
      try {
        const parsed = JSON.parse(await body.text());
        return parsed?.error ?? parsed?.message ?? 'Please try again.';
      } catch { /* not JSON */ }
    }
    const status = (err as { status?: number })?.status;
    if (status === 404) return 'Organisation not found.';
    if (status === 401 || status === 403) return 'This needs a platform-admin session.';
    return (body as { error?: string; message?: string })?.error
        ?? (body as { message?: string })?.message
        ?? 'Please try again.';
  }

  // ── Add organisation (POST /api/platform/organisations) ────────
  openAdd(): void {
    this.addError.set('');
    this.addResult.set(null);
    this.newOrgCompanyName = '';
    this.newOrgPrimaryEmail = '';
    this.newOrgIndustry = '';
    this.showAdd.set(true);
  }

  closeAdd(): void {
    this.showAdd.set(false);
  }

  submitAdd(): void {
    if (this.addSubmitting() || !this.newOrgCompanyName.trim() || !this.newOrgPrimaryEmail.trim()) return;
    this.addError.set('');
    this.addSubmitting.set(true);

    this.platformAdmin.createOrganisation({
      companyName: this.newOrgCompanyName.trim(),
      primaryEmail: this.newOrgPrimaryEmail.trim(),
      industry: this.newOrgIndustry.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.addSubmitting.set(false);
        this.addResult.set(res.data);
        this.refresh();
      },
      error: (err) => {
        this.addSubmitting.set(false);
        this.addError.set(err?.error?.message ?? 'Could not create the organisation.');
      },
    });
  }

  // ── Edit organisation ─────────────────────────────────────────
  openEdit(org: PlatformOrgListItem): void {
    this.editError.set('');
    this.resetPwError.set('');
    this.resetPwResult.set('');
    this.dbConfigNotice.set('');
    this.agentStatusNotice.set('');
    this.emailError.set('');
    this.emailSent.set('');
    this.emailType = 'resend_welcome';
    this.emailCustomSubject = '';
    this.emailCustomMessage = '';

    this.renameError.set('');
    this.editOrgUrlName = org.orgUrlName;
    this.slugError.set('');
    // `.klock` is a fixed suffix — edit only the prefix.
    this.editOrgSlug = org.orgSlug.replace(/\.klock$/i, '');

    this.editCompanyName = org.companyName;
    this.editAccentColor = org.accentColor ?? '';
    this.editIsActive = org.isActive;
    this.editSubscriptionStatus = org.subscriptionStatus;
    this.editSubscriptionPlan = org.subscriptionPlan ?? '';
    this.editTrialEndsAt = org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '';
    this.editSubscriptionExpiresAt = org.subscriptionExpiresAt ? org.subscriptionExpiresAt.slice(0, 10) : '';
    this.editMaxEmployees = org.maxEmployees;
    this.editMaxAdminAccounts = org.maxAdminAccounts;
    this.editInactivityRetentionDays = org.inactivityRetentionDays;
    this.editFeatures = new Set(org.features ?? []);

    // Placeholder sections — never populated from any real source.
    this.dbHost = '';
    this.dbName = '';
    this.dbUsername = '';
    this.dbPassword = '';
    this.agentStatus = 'pending';

    this.editingOrg.set(org);
  }

  closeEdit(): void {
    this.editingOrg.set(null);
  }

  /**
   * The date pickers emit a plain 'YYYY-MM-DD', but the API's trialEndsAt /
   * subscriptionExpiresAt expect a full ISO datetime — a date-only string isn't
   * applied. Normalise to midnight UTC so the change actually sticks.
   */
  private toIsoDateTime(dateOnly: string): string | undefined {
    const d = (dateOnly || '').trim();
    if (!d) return undefined;
    return d.includes('T') ? d : `${d}T00:00:00Z`;
  }

  /** Read the value off a native color input's change event. */
  asColor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  // Per-org custom feature overrides
  readonly featureCodes = FEATURE_CODES;
  readonly featureLabels = FEATURE_LABELS;
  featureLabel(code: string): string { return this.featureLabels[code] ?? code; }
  hasEditFeature(code: string): boolean { return this.editFeatures.has(code); }
  toggleEditFeature(code: string): void {
    this.editFeatures.has(code) ? this.editFeatures.delete(code) : this.editFeatures.add(code);
  }

  /**
   * Manually flipping the payment status can otherwise leave stale plan/date
   * fields behind from whatever status the org was in before (e.g. an old paid
   * plan + future expiry still sitting there after switching back to "trial").
   * Reset them on every change so the admin always fills in fresh values for
   * the new status, instead of risking a mismatched save.
   */
  onSubscriptionStatusChange(next: SubscriptionStatus): void {
    this.editSubscriptionStatus = next;
    this.editSubscriptionPlan = '';
    this.editSubscriptionExpiresAt = '';
    // Trial end is the one field that's actually relevant to the new status —
    // give it a fresh 14-day default instead of just blanking it; anything
    // else has no trial period, so clear it outright.
    this.editTrialEndsAt = next === 'trial' ? this.defaultTrialEndDate() : '';
  }

  private defaultTrialEndDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }

  submitEdit(): void {
    const org = this.editingOrg();
    if (!org || this.editSubmitting()) return;
    this.editError.set('');

    // ── True PATCH: send ONLY changed fields (per the API contract) ──────────
    const body: UpdatePlatformOrgRequest = {};

    const name = this.editCompanyName.trim();
    if (name && name !== org.companyName) body.companyName = name;

    const accent = this.editAccentColor.trim();
    if (accent !== (org.accentColor ?? '')) body.accentColor = accent || undefined;

    if (this.editIsActive !== org.isActive) body.isActive = this.editIsActive;

    // Note: an explicit '' is sent (not `undefined`) when a field is CLEARED —
    // `undefined` keys are dropped by JSON.stringify, which the API reads as
    // "unchanged", not "clear it". `|| undefined` here would silently defeat
    // the plan/date reset that happens on a manual status change below.
    const plan = this.editSubscriptionPlan.trim();
    if (plan !== (org.subscriptionPlan ?? '')) body.subscriptionPlan = plan;

    if ((this.editMaxEmployees ?? null) !== (org.maxEmployees ?? null)) body.maxEmployees = this.editMaxEmployees ?? undefined;
    if ((this.editMaxAdminAccounts ?? null) !== (org.maxAdminAccounts ?? null)) body.maxAdminAccounts = this.editMaxAdminAccounts ?? undefined;
    if ((this.editInactivityRetentionDays ?? null) !== (org.inactivityRetentionDays ?? null)) body.inactivityRetentionDays = this.editInactivityRetentionDays ?? undefined;

    // Dates — compare on the date-only form the pickers use; send as ISO datetime,
    // or an explicit '' when cleared (see note above — never send `undefined` here).
    const origTrial  = org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '';
    const origExpiry = org.subscriptionExpiresAt ? org.subscriptionExpiresAt.slice(0, 10) : '';
    const trialChanged = this.editTrialEndsAt !== origTrial;
    if (trialChanged) body.trialEndsAt = this.editTrialEndsAt ? this.toIsoDateTime(this.editTrialEndsAt) : '';
    if (this.editSubscriptionExpiresAt !== origExpiry) {
      body.subscriptionExpiresAt = this.editSubscriptionExpiresAt ? this.toIsoDateTime(this.editSubscriptionExpiresAt) : '';
    }

    // Status: send when it changed, OR always pair it with a trial-date change —
    // the API extends a trial from `{ subscriptionStatus:'trial', trialEndsAt }`.
    if (this.editSubscriptionStatus !== org.subscriptionStatus || trialChanged) {
      body.subscriptionStatus = this.editSubscriptionStatus;
    }

    // Features — send only if the set changed.
    const submittedFeatures = [...this.editFeatures];
    const featuresChanged =
      [...submittedFeatures].sort().join(',') !== [...(org.features ?? [])].sort().join(',');
    if (featuresChanged) body.features = submittedFeatures;

    if (Object.keys(body).length === 0) {
      this.closeEdit();   // nothing to save
      return;
    }

    this.editSubmitting.set(true);
    this.platformAdmin.updateOrganisation(org.orgSlug, body).subscribe({
      next: (res) => {
        this.editSubmitting.set(false);
        // Response omits features — keep the set we submitted if we changed it.
        const merged = { ...this.mergeOrg(org, res.data), features: body.features ?? org.features };
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? merged : o));
        this.editingOrg.set(merged);
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(merged);
        this.toast.success('Organisation updated', name || org.companyName);
      },
      error: (err) => {
        this.editSubmitting.set(false);
        this.editError.set(err?.error?.error ?? err?.error?.message ?? 'Could not save changes.');
      },
    });
  }

  /** PUT /api/platform/organisations/{slug} { orgUrlName } — renames the URL path segment. */
  submitRename(): void {
    const org = this.editingOrg();
    if (!org || this.renameSubmitting() || !this.editOrgUrlName.trim() || this.editOrgUrlName.trim() === org.orgUrlName) return;
    this.renameError.set('');
    this.renameSubmitting.set(true);

    this.platformAdmin.renameOrgUrlName(org.orgSlug, this.editOrgUrlName.trim()).subscribe({
      next: (res) => {
        this.renameSubmitting.set(false);
        const merged = this.mergeOrg(org, res.data);
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? merged : o));
        this.editingOrg.set(merged);
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(merged);
        this.toast.success('URL name updated', `/${merged.orgUrlName}/app`);
      },
      error: (err) => {
        this.renameSubmitting.set(false);
        this.renameError.set(
          err?.status === 409
            ? 'That name is already taken by another organisation.'
            : (err?.error?.message ?? 'Could not rename — check the format (lowercase letters/numbers/hyphens, 2-40 chars).'),
        );
      },
    });
  }

  /**
   * PUT /api/platform/organisations/{slug} { orgSlug } — changes the org's login
   * code (Klock-admin only). Anyone currently logged into the org keeps a token
   * with the old slug, so they're effectively signed out until they log in again.
   */
  submitSlug(): void {
    const org = this.editingOrg();
    // Only the prefix is editable; `.klock` is appended as a constant suffix.
    const prefix = this.editOrgSlug.trim().replace(/\.klock$/i, '');
    const next = prefix ? `${prefix}.klock` : '';
    if (!org || this.slugSubmitting() || !next || next === org.orgSlug) return;
    this.slugError.set('');
    this.slugSubmitting.set(true);

    this.platformAdmin.updateOrganisation(org.orgSlug, { orgSlug: next }).subscribe({
      next: (res) => {
        this.slugSubmitting.set(false);
        const merged = this.mergeOrg(org, res.data);
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? merged : o));
        this.editingOrg.set(merged);
        this.editOrgSlug = merged.orgSlug.replace(/\.klock$/i, '');
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(merged);
        this.toast.success('Login code changed', merged.orgSlug);
      },
      error: (err) => {
        this.slugSubmitting.set(false);
        this.slugError.set(
          err?.status === 409
            ? 'That login code is already in use by another organisation.'
            : (err?.error?.message ?? 'Could not change the login code — check the format (lowercase letters/numbers/hyphens/dots).'),
        );
      },
    });
  }

  /** Calls the requested-but-not-yet-built reset-admin-password endpoint — see SERVER_CHANGES_REQUEST.md §0. */
  resetAdminPassword(): void {
    const org = this.editingOrg();
    if (!org || this.resetPwSubmitting()) return;
    this.resetPwError.set('');
    this.resetPwResult.set('');
    this.resetPwSubmitting.set(true);

    this.platformAdmin.resetOrgAdminPassword(org.orgSlug).subscribe({
      next: (res) => {
        this.resetPwSubmitting.set(false);
        this.resetPwResult.set(res.data.temporaryPassword);
      },
      error: (err) => {
        this.resetPwSubmitting.set(false);
        this.resetPwError.set(
          err?.status === 404
            ? 'Organisation not found.'
            : (err?.error?.message ?? 'Could not reset the password.'),
        );
      },
    });
  }

  /** Calls the requested-but-not-yet-built send-email endpoint — see SERVER_CHANGES_REQUEST.md §0d. */
  sendEmail(): void {
    const org = this.editingOrg();
    if (!org || this.emailSubmitting()) return;
    if (this.emailType === 'custom' && (!this.emailCustomSubject.trim() || !this.emailCustomMessage.trim())) return;

    this.emailError.set('');
    this.emailSent.set('');
    this.emailSubmitting.set(true);

    this.platformAdmin.sendOrgEmail(org.orgSlug, {
      type: this.emailType,
      ...(this.emailType === 'custom' ? { subject: this.emailCustomSubject.trim(), message: this.emailCustomMessage.trim() } : {}),
    }).subscribe({
      next: () => {
        this.emailSubmitting.set(false);
        this.emailSent.set(`Sent to ${org.primaryEmail}.`);
      },
      error: (err) => {
        this.emailSubmitting.set(false);
        this.emailError.set(
          err?.status === 404
            ? 'This action needs a backend endpoint that doesn\'t exist yet (see SERVER_CHANGES_REQUEST.md).'
            : (err?.error?.message ?? 'Could not send the email.'),
        );
      },
    });
  }

  /** UI shell only — intentionally never sends these fields anywhere. See class-level comment. */
  saveDbConfig(): void {
    this.dbConfigNotice.set('Not connected to any backend — see SERVER_CHANGES_REQUEST.md §0.');
  }

  /** UI shell only — intentionally never sends this field anywhere. See class-level comment. */
  saveAgentStatus(): void {
    this.agentStatusNotice.set('Not connected to any backend — see SERVER_CHANGES_REQUEST.md §0.');
  }

  // ── Helpers ───────────────────────────────────────────────────
  emailTypeLabel(t: OrgEmailType): string {
    return {
      resend_welcome: 'Resend Welcome Email',
      resend_otp: 'Resend Verification Code',
      subscription_alert: 'Subscription / Payment Alert',
      custom: 'Custom Message',
    }[t];
  }

  subscriptionLabel(s: SubscriptionStatus): string {
    return { trial: 'Trial', active: 'Active', expired: 'Expired', cancelled: 'Cancelled' }[s];
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return this.loc.formatDate(iso);
  }

  onSearch(e: Event): void             { this.search.set((e.target as HTMLInputElement).value); }
  onSubscriptionFilter(e: Event): void { this.subscriptionFilter.set((e.target as HTMLSelectElement).value as any); }
}
