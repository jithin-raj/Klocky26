import { Component, ChangeDetectionStrategy, Input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { AiService } from '../../../core/services/ai.service';
import { OrgNavigationService } from '../../../core/services/org-navigation.service';
import { LocalizationService } from '../../../core/services/localization.service';
import { AiReportType } from '../../../core/models/ai.model';

interface Chip { label: string; value: number; }
interface ProportionRow { label: string; value: number; color: string; }
interface BarRow { name: string; value: number; pct: number; }
interface BalanceRow { label: string; used: number; total?: number; remaining?: number; }

const PROPORTION_COLORS: Record<string, string> = {
  Present: '#22c55e', 'Half Day': '#f59e0b', Absent: '#ef4444', 'On Leave': '#6366f1',
  Late: '#f59e0b', 'Not Clocked In': '#94a3b8',
};

// ─────────────────────────────────────────────────────────────────────────────
// AiReportCardComponent — POST /api/ai/report card for dashboards + report
// pages. Self-gating like the chat widget (hidden/locked/full based on
// AiService). `metrics` shape varies by scope (organisation/self) and report
// `type`, so every visualisation here is built from optional-chained,
// filtered lookups — sections with no data simply don't render, the
// narrative always does.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-ai-report-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './ai-report-card.component.html',
  styleUrl: './ai-report-card.component.scss',
})
export class AiReportCardComponent {
  @Input() type: AiReportType = 'overview';

  private readonly ai = inject(AiService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly loc = inject(LocalizationService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly available = this.ai.available;
  readonly locked = this.ai.locked;

  loading = signal(false);
  error = signal('');
  title = signal('');
  narrativeHtml = signal<SafeHtml | null>(null);
  narrativeRaw = signal('');
  generatedAt = signal<string | null>(null);
  copied = signal(false);

  private readonly metrics = signal<any>(null);
  private _loadedOnce = false;

  constructor() {
    // Status may still be loading when this card mounts — fetch the first
    // time `available` actually flips true, not just once at construction.
    effect(() => {
      if (this.ai.available() && !this._loadedOnce) {
        this._loadedOnce = true;
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.ai.report(this.type).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.title.set(res.title || 'AI overview');
        this.narrativeRaw.set(res.narrative || '');
        const html = marked.parse(res.narrative ?? '', { async: false }) as string;
        this.narrativeHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.generatedAt.set(res.generatedAt ?? null);
        this.metrics.set(res.metrics ?? null);
      },
      error: (err) => this._handleError(err),
    });
  }

  regenerate(): void {
    if (this.loading()) return;
    this.load();
  }

  private _handleError(err: any): void {
    this.loading.set(false);
    if (err?.status === 403 && err?.error?.code === 'feature_not_in_plan') {
      this.ai.markNotEntitled();
      return;
    }
    if (err?.status === 503) {
      this.error.set('AI assistant is temporarily unavailable.');
      return;
    }
    this.error.set('Could not generate this report. Please try again.');
  }

  goToBilling(): void {
    this.orgNav.navigate(['app', 'billing']);
  }

  copy(): void {
    navigator.clipboard.writeText(this.narrativeRaw()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => { /* clipboard blocked — nothing else to do */ });
  }

  /** "Updated 5m ago" / falls back to the org's configured date format past a week. */
  updatedLabel(): string {
    const iso = this.generatedAt();
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Updated just now';
    if (m < 60) return `Updated ${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Updated ${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `Updated ${d}d ago`;
    return `Updated ${this.loc.formatDate(iso)}`;
  }

  // ── Adaptive metric visualisations — every one guards for missing fields ──

  readonly todayBreakdown = computed<ProportionRow[]>(() => {
    const t = this.metrics()?.dashboard?.todayStats;
    return this._proportionRows(t, ['Present', 'Absent', 'On Leave', 'Late', 'Not Clocked In'],
      ['present', 'absent', 'onLeave', 'late', 'notClockedIn']);
  });
  readonly todayTotal = computed(() => this.todayBreakdown().reduce((s, r) => s + r.value, 0) || 1);

  readonly monthBreakdown = computed<ProportionRow[]>(() => {
    const mo = this.metrics()?.dashboard?.month;
    return this._proportionRows(mo, ['Present', 'Half Day', 'Absent', 'On Leave'],
      ['present', 'half', 'absent', 'onLeave']);
  });
  readonly monthTotal = computed(() => this.monthBreakdown().reduce((s, r) => s + r.value, 0) || 1);

  private _proportionRows(obj: any, labels: string[], keys: string[]): ProportionRow[] {
    if (!obj) return [];
    return labels
      .map((label, i) => ({ label, value: obj[keys[i]], color: PROPORTION_COLORS[label] ?? '#94a3b8' }))
      .filter((r): r is ProportionRow => typeof r.value === 'number' && r.value > 0);
  }

  readonly topAbsentees = computed<BarRow[]>(() => {
    const list = this.metrics()?.thisCycle?.topAbsentees;
    if (!Array.isArray(list) || !list.length) return [];
    const max = Math.max(...list.map((r: any) => r?.absentDays || 0), 1);
    return list.slice(0, 6)
      .filter((r: any) => r?.name != null && typeof r?.absentDays === 'number')
      .map((r: any) => ({ name: r.name, value: r.absentDays, pct: Math.round((r.absentDays / max) * 100) }));
  });

  readonly cycleChips = computed<Chip[]>(() => this._chips(this.metrics()?.thisCycle, [
    ['presentDays', 'Present Days'], ['halfDays', 'Half Days'], ['absentDays', 'Absent Days'],
    ['lateInstances', 'Late'], ['totalWorkedHours', 'Worked Hrs'], ['approvedLeaveDays', 'Approved Leave'],
  ]));

  readonly headcountChips = computed<Chip[]>(() => this._chips(this.metrics()?.dashboard?.headcount, [
    ['totalEmployees', 'Employees'], ['admins', 'Admins'], ['departments', 'Departments'],
  ]));

  readonly pendingChips = computed<Chip[]>(() => this._chips(this.metrics()?.dashboard?.pending, [
    ['leave', 'Leave'], ['regularization', 'Regularization'], ['compOff', 'Comp Off'], ['total', 'Total Pending'],
  ]));

  readonly selfPendingChips = computed<Chip[]>(() => this._chips(this.metrics()?.dashboard, [
    ['pendingLeaves', 'Pending Leaves'], ['pendingRegs', 'Pending Regularizations'],
    ['pendingComp', 'Pending Comp-Off'], ['openTasks', 'Open Tasks'],
  ]));

  private _chips(obj: any, pairs: [string, string][]): Chip[] {
    if (!obj) return [];
    return pairs
      .map(([key, label]) => ({ label, value: obj[key] }))
      .filter((c): c is Chip => typeof c.value === 'number');
  }

  readonly leaveBalances = computed<BalanceRow[]>(() => {
    const list = this.metrics()?.dashboard?.leaveBalances;
    if (!Array.isArray(list) || !list.length) return [];
    return list
      .filter((r: any) => r && typeof r === 'object')
      .map((r: any) => ({
        label: r.label || r.type || 'Leave',
        used: typeof r.used === 'number' ? r.used : 0,
        total: typeof r.total === 'number' ? r.total : undefined,
        remaining: typeof r.remaining === 'number' ? r.remaining : undefined,
      }));
  });

  readonly hasAnyMetrics = computed(() =>
    this.todayBreakdown().length > 0 || this.monthBreakdown().length > 0 || this.topAbsentees().length > 0 ||
    this.cycleChips().length > 0 || this.headcountChips().length > 0 || this.pendingChips().length > 0 ||
    this.selfPendingChips().length > 0 || this.leaveBalances().length > 0);
}
