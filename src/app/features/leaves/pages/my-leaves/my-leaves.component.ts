import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { UiSelectComponent, UiIconComponent } from '../../../../shared/components';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { LeaveService } from '../../../../core/services/leave.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';
import {
  Holiday, LeaveBalance, LeaveRecord, LeaveTypeOption,
} from '../../../../core/models/leave.model';

export type LeaveTab = 'balance' | 'holidays' | 'history';

const TYPE_COLORS = ['#6366f1','#f59e0b','#14b8a6','#ec4899','#22c55e','#8b5cf6','#ef4444','#0ea5e9'];
const BAR_MAX_H   = 52;

@Component({
  selector: 'app-my-leaves',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiIconComponent, OrgDateOnlyPipe],
  templateUrl: './my-leaves.component.html',
  styleUrl:    './my-leaves.component.scss',
})
export class MyLeavesComponent implements OnInit {
  private readonly svc      = inject(LeaveService);
  private readonly toast    = inject(ToastService);
  private readonly appState = inject(AppStateService);
  private readonly router   = inject(Router);

  readonly todayIso    = new Date().toISOString().slice(0, 10);
  readonly currentYear = new Date().getFullYear();

  // ── Tabs ──────────────────────────────────────────────────────────────
  activeTab = signal<LeaveTab>('balance');

  // ── Data ──────────────────────────────────────────────────────────────
  types    = signal<LeaveTypeOption[]>([]);
  balances = signal<LeaveBalance[]>([]);
  records  = signal<LeaveRecord[]>([]);
  loading  = signal(true);
  busyId   = signal<string | null>(null);

  // ── Holidays ──────────────────────────────────────────────────────────
  holidays        = signal<Holiday[]>([]);
  loadingHolidays = signal(false);
  holidaysFetched = signal(false);

  // ── History filter ────────────────────────────────────────────────────
  historyMonth = signal('');

  // ── Derived ───────────────────────────────────────────────────────────
  readonly orgPrefix  = computed(() => `/${this.appState.orgUrlName() || 'default'}`);
  readonly userGender = computed(() => ((this.appState.user() as any)?.gender ?? '').toLowerCase());

  readonly typeColorMap = computed(() => {
    const map = new Map<string, string>();
    this.types().forEach((t, i) => map.set(t.leaveTypeId, TYPE_COLORS[i % TYPE_COLORS.length]));
    return map;
  });

  readonly filteredBalances = computed(() => {
    const g       = this.userGender();
    const typeMap = new Map(this.types().map(t => [t.leaveTypeId, t]));
    return this.balances().filter(b => {
      const t = typeMap.get(b.leaveTypeId);
      if (!t?.applicableTo || t.applicableTo === 'all') return true;
      if (g === 'male'   && t.applicableTo === 'female') return false;
      if (g === 'female' && t.applicableTo === 'male')   return false;
      return true;
    });
  });

  /** True when every visible leave type has zero remaining balance. */
  readonly noLeavesAvailable = computed(() => {
    const bs = this.filteredBalances();
    return bs.length > 0 && bs.every(b => b.remainingDays === 0);
  });

  readonly monthlyChartData = computed(() => {
    const year   = this.currentYear;
    const LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const months = LABELS.map((label, idx) => ({ label, idx, total: 0 }));

    this.records()
      .filter(r => r.status !== 'cancelled' && r.status !== 'rejected')
      .forEach(r => {
        const d = new Date(r.fromDate);
        if (d.getFullYear() === year) months[d.getMonth()].total += r.days;
      });

    const maxDays    = Math.max(...months.map(m => m.total), 1);
    const totalTaken = months.reduce((s, m) => s + m.total, 0);
    return {
      months:     months.map(m => ({ ...m, heightPx: Math.round((m.total / maxDays) * BAR_MAX_H) })),
      totalTaken,
    };
  });

  readonly filteredRecords = computed(() => {
    const m = this.historyMonth();
    return m ? this.records().filter(r => r.fromDate.startsWith(m)) : this.records();
  });

  readonly monthOptions = computed(() => {
    const seen = new Set<string>();
    this.records().forEach(r => seen.add(r.fromDate.slice(0, 7)));
    return [...seen].sort().reverse().map(m => {
      const [y, mo] = m.split('-');
      return {
        label: new Date(+y, +mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
        value: m,
      };
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit() { this.loadData(); }

  private loadData() {
    this.loading.set(true);
    this.svc.types().subscribe({ next: t => this.types.set(t), error: () => {} });
    this.svc.my().subscribe({
      next: res => {
        this.balances.set(res.balances ?? []);
        this.records.set(res.records   ?? []);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  // ── Tab actions ───────────────────────────────────────────────────────
  switchTab(tab: LeaveTab) {
    this.activeTab.set(tab);
    if (tab === 'holidays' && !this.holidaysFetched()) { this.loadHolidays(); }
  }

  private loadHolidays() {
    this.loadingHolidays.set(true);
    this.svc.holidays().subscribe({
      next: h  => { this.holidays.set(h);  this.loadingHolidays.set(false); this.holidaysFetched.set(true); },
      error: () => { this.holidays.set([]); this.loadingHolidays.set(false); this.holidaysFetched.set(true); },
    });
  }

  // Navigate to the unified Tasks workspace, optionally pre-selecting a leave type
  openApplyFor(typeId: string) {
    this.router.navigate([this.orgPrefix(), 'app', 'tasks'], {
      queryParams: { new: 'leave', leaveTypeId: typeId, returnUrl: `${this.orgPrefix()}/app/leaves/my` },
    });
  }

  navigateToApply() {
    this.router.navigate([this.orgPrefix(), 'app', 'tasks'], {
      queryParams: { new: 'leave', returnUrl: `${this.orgPrefix()}/app/leaves/my` },
    });
  }

  goToRegularisation() {
    this.router.navigate([this.orgPrefix(), 'app', 'tasks'], {
      queryParams: { new: 'regularisation', returnUrl: `${this.orgPrefix()}/app/leaves/my` },
    });
  }

  cancel(id: string) {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.svc.cancel(id).subscribe({
      next: () => { this.busyId.set(null); this.loadData(); },
      error: err => {
        this.busyId.set(null);
        this.toast.error('Could not cancel', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  canCancel(r: LeaveRecord): boolean {
    return r.status === 'pending' || (r.status === 'approved' && r.fromDate > this.todayIso);
  }

  typeColor(typeId: string): string {
    return this.typeColorMap().get(typeId) ?? '#6366f1';
  }

  usedBarPct(b: LeaveBalance): number {
    const total = (b.totalDays + b.carriedForward) || 1;
    return Math.min(100, Math.round((b.usedDays / total) * 100));
  }

  readonly sortedHolidays = computed(() =>
    [...this.holidays()].sort((a, b) => a.date.localeCompare(b.date))
  );

  holidayTypeLabel(type: string): string {
    const map: Record<string, string> = {
      national: 'National', optional: 'Optional', regional: 'Regional', company: 'Company',
    };
    return map[type] ?? type;
  }

  takeOptionalHoliday(h: Holiday) {
    this.router.navigate([this.orgPrefix(), 'app', 'tasks'], {
      queryParams: { new: 'leave', date: h.date, returnUrl: `${this.orgPrefix()}/app/leaves/my` },
    });
  }

  stageLabel(stage: string): string {
    if (stage === 'manager') return 'Awaiting manager';
    if (stage === 'hr')      return 'Awaiting HR';
    return '';
  }

  monthLabel(iso: string): string {
    if (!iso) return '';
    const [y, m] = iso.split('-');
    return new Date(+y, +m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
