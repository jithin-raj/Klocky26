import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformAdminService } from '../../../../core/services/platform-admin.service';
import { PlatformOrgListItem } from '../../../../core/models/platform-auth.model';
import { UiSelectComponent } from '../../../../shared/components';

@Component({
  selector: 'klocky-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSelectComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly platformAdmin = inject(PlatformAdminService);

  readonly orgs    = signal<PlatformOrgListItem[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  readonly statusFilterOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Deactivated', value: 'inactive' },
  ];

  ngOnInit(): void {
    this.platformAdmin.listOrganisations().subscribe({
      next: (res) => { this.orgs.set(res.data); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message ?? 'Could not load organisations.');
      },
    });
    this.loading.set(true);
  }

  // ── Stats ─────────────────────────────────────────────────────
  readonly totalOrgs    = computed(() => this.orgs().length);
  readonly activeOrgs   = computed(() => this.orgs().filter(o => o.isActive).length);
  readonly inactiveOrgs = computed(() => this.orgs().filter(o => !o.isActive).length);
  readonly trialOrgs    = computed(() => this.orgs().filter(o => o.subscriptionStatus === 'trial').length);
  readonly newThisMonth = computed(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.orgs().filter(o => o.createdAt?.startsWith(ym)).length;
  });

  // ── Filtered list ──────────────────────────────────────────────
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.statusFilter();
    return this.orgs().filter(o => {
      const matchSearch = !q || o.companyName.toLowerCase().includes(q) || o.orgSlug.includes(q) || o.primaryEmail.toLowerCase().includes(q);
      const matchStatus = s === 'all' || (s === 'active' ? o.isActive : !o.isActive);
      return matchSearch && matchStatus;
    });
  });

  // ── Actions ───────────────────────────────────────────────────
  selectedOrg = signal<PlatformOrgListItem | null>(null);

  viewOrg(org: PlatformOrgListItem): void { this.selectedOrg.set(org); }
  closeDetail(): void { this.selectedOrg.set(null); }

  /** Maps to PUT .../organisations/{slug} { isActive } — there's no separate "suspend" endpoint. */
  toggleActive(org: PlatformOrgListItem): void {
    this.platformAdmin.updateOrganisation(org.orgSlug, { isActive: !org.isActive }).subscribe({
      next: (res) => {
        this.orgs.update(list => list.map(o => o.orgSlug === org.orgSlug ? res.data : o));
        if (this.selectedOrg()?.orgSlug === org.orgSlug) this.selectedOrg.set(res.data);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onStatusFilter(value: string): void {
    this.statusFilter.set(value as any);
  }
}
