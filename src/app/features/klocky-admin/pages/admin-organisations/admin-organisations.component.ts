import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformAdminService } from '../../../../core/services/platform-admin.service';
import { PlatformOrgListItem, SubscriptionStatus, OrgEmailType } from '../../../../core/models/platform-auth.model';
import {
  UiSelectComponent, UiDatePickerComponent, SelectOption,
  UiDataGridComponent, GridColumn, GridAction,
  UiFormModalComponent, UiFormSectionComponent, UiFormGridComponent, UiFormFieldComponent,
  UiInputComponent, UiToggleComponent,
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
    UiInputComponent, UiToggleComponent,
  ],
  templateUrl: './admin-organisations.component.html',
  styleUrl: './admin-organisations.component.scss',
})
export class AdminOrganisationsComponent implements OnInit {
  private readonly platformAdmin = inject(PlatformAdminService);

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
  ];

  readonly selectedOrg  = signal<PlatformOrgListItem | null>(null);

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
  viewOrg(org: PlatformOrgListItem): void { this.selectedOrg.set(org); }
  closeDetail(): void { this.selectedOrg.set(null); }

  /** Maps to PUT .../organisations/{slug} { isActive } — there's no separate "suspend" endpoint. */
  toggleActive(org: PlatformOrgListItem): void {
    const nextActive = !org.isActive;
    this.platformAdmin.updateOrganisation(org.orgSlug, { isActive: nextActive }).subscribe({
      next: (res) => {
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? res.data : o));
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(res.data);
      },
    });
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

  submitEdit(): void {
    const org = this.editingOrg();
    if (!org || this.editSubmitting()) return;
    this.editError.set('');
    this.editSubmitting.set(true);

    this.platformAdmin.updateOrganisation(org.orgSlug, {
      companyName: this.editCompanyName.trim(),
      accentColor: this.editAccentColor.trim() || undefined,
      isActive: this.editIsActive,
      subscriptionStatus: this.editSubscriptionStatus,
      subscriptionPlan: this.editSubscriptionPlan.trim() || undefined,
      trialEndsAt: this.editTrialEndsAt || undefined,
      subscriptionExpiresAt: this.editSubscriptionExpiresAt || undefined,
      maxEmployees: this.editMaxEmployees ?? undefined,
      maxAdminAccounts: this.editMaxAdminAccounts ?? undefined,
      inactivityRetentionDays: this.editInactivityRetentionDays ?? undefined,
    }).subscribe({
      next: (res) => {
        this.editSubmitting.set(false);
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? res.data : o));
        this.editingOrg.set(res.data);
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(res.data);
      },
      error: (err) => {
        this.editSubmitting.set(false);
        this.editError.set(err?.error?.message ?? 'Could not save changes.');
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
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? res.data : o));
        this.editingOrg.set(res.data);
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(res.data);
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
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? res.data : o));
        this.editingOrg.set(res.data);
        this.editOrgSlug = res.data.orgSlug.replace(/\.klock$/i, '');
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(res.data);
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
            ? 'This action needs a backend endpoint that doesn\'t exist yet (see SERVER_CHANGES_REQUEST.md).'
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
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onSearch(e: Event): void             { this.search.set((e.target as HTMLInputElement).value); }
  onSubscriptionFilter(e: Event): void { this.subscriptionFilter.set((e.target as HTMLSelectElement).value as any); }
}
