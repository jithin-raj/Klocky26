import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PayrollService } from '../../../../core/services/payroll.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { UpgradePromptService } from '../../../../shared/components/upgrade-prompt/upgrade-prompt.service';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { UiDatePickerComponent } from '../../../../shared/components/ui-datepicker/ui-datepicker.component';
import {
  SalaryStructureDto, SetSalaryStructureRequest, SalaryComponentInput, SalaryStructureReason,
  PayGradeDto, BonusDto, PayFrequency, PayslipDto, PayslipLineType, AnnualSummaryDto,
} from '../../../../core/models/payroll.model';
import { EmployeeResponse } from '../../../employees/models/employee-api.model';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';
import { WEEK_STARTS } from '../../../../core/config/form-options.const';
import { triggerBlobDownload } from '../../../../core/utils/file-download.util';

interface ComponentRow extends SalaryComponentInput {
  _key: number;
}

@Component({
  selector: 'app-employee-salary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent, OrgDateOnlyPipe],
  templateUrl: './employee-salary.component.html',
  styleUrl: './employee-salary.component.scss',
})
export class EmployeeSalaryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly payrollSvc = inject(PayrollService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly permissions = inject(PermissionService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);
  private readonly upgradePrompt = inject(UpgradePromptService);

  readonly canEdit = computed(() => this.permissions.can('payroll', 2));

  userId = '';
  employee = signal<EmployeeResponse | null>(null);
  grades = signal<PayGradeDto[]>([]);
  current = signal<SalaryStructureDto | null>(null);
  history = signal<SalaryStructureDto[]>([]);
  bonuses = signal<BonusDto[]>([]);
  loading = signal(true);
  saving = signal(false);

  editing = signal(false);
  payGradeId = signal<string | null>(null);
  effectiveFrom = signal('');
  reason = signal<SalaryStructureReason>('revision');
  notes = signal('');
  rows = signal<ComponentRow[]>([]);
  payFrequency = signal<PayFrequency>('monthly');
  /** Capitalized display value ('Monday'), same convention as org-profile's workWeekStartDay — lowercased on save. */
  weekStart = signal('Monday');
  /** Last value GET returned — reverted to on a 403 `feature_not_in_plan` save rejection. */
  private _lastLoadedPayFrequency: PayFrequency = 'monthly';
  private _rowKey = 0;

  readonly gradeOptions = computed(() => [
    { label: 'No grade', value: '' },
    ...this.grades().map(g => ({ label: g.name, value: g.id })),
  ]);
  readonly reasonOptions: { label: string; value: SalaryStructureReason }[] = [
    { label: 'Initial', value: 'initial' },
    { label: 'Increment', value: 'increment' },
    { label: 'Revision', value: 'revision' },
  ];
  readonly frequencyOptions: { label: string; value: PayFrequency }[] = [
    { label: 'Monthly', value: 'monthly' },
    { label: 'Weekly', value: 'weekly' },
  ];
  readonly weekStartOptions = WEEK_STARTS.map(w => ({ label: w, value: w }));

  readonly totalEarnings = computed(() => this.rows().filter(r => r.type === 'earning').reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0));
  readonly totalDeductions = computed(() => this.rows().filter(r => r.type === 'deduction').reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0));
  readonly netMonthly = computed(() => this.totalEarnings() - this.totalDeductions());
  readonly basicCount = computed(() => this.rows().filter(r => r.type === 'earning' && r.isBasic).length);
  readonly isValid = computed(() =>
    !!this.effectiveFrom() && this.rows().length > 0 && this.basicCount() === 1 &&
    this.rows().every(r => r.name.trim() && r.monthlyAmount >= 0));

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.employeeSvc.getById(this.userId).subscribe({
      next: (res) => this.employee.set(res.data),
      error: () => {},
    });
    this.payrollSvc.getGrades().subscribe({ next: (g) => this.grades.set(g), error: () => {} });
    this.payrollSvc.getStructure(this.userId).subscribe({
      next: (s) => {
        this.current.set(s);
        this._lastLoadedPayFrequency = s?.payFrequency ?? 'monthly';
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
    this.payrollSvc.getStructureHistory(this.userId).subscribe({
      next: (h) => this.history.set(h),
      error: () => {},
    });
    this.payrollSvc.getBonuses(this.userId).subscribe({
      next: (b) => this.bonuses.set(b),
      error: () => {},
    });
    this.loadPreview();
    this.loadSummary();
  }

  back(): void {
    this.orgNav.navigate(['app', 'compensation']);
  }

  // ── Edit form ─────────────────────────────────────────────────────────────
  startEdit(): void {
    if (!this.canEdit()) return;
    const cur = this.current();
    this.payGradeId.set(cur?.payGradeId ?? null);
    this.effectiveFrom.set(new Date().toISOString().slice(0, 10));
    this.reason.set(cur ? 'revision' : 'initial');
    this.notes.set('');
    this.rows.set((cur?.components ?? []).map(c => this.toRow(c)));
    if (!this.rows().length) this.addRow('earning', true);
    this.payFrequency.set(cur?.payFrequency ?? 'monthly');
    this.weekStart.set(this._capitalize(cur?.weekStart ?? 'monday'));
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  private _capitalize(v: string): string {
    return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v;
  }

  private toRow(c: { name: string; type: 'earning' | 'deduction'; monthlyAmount: number; isBasic: boolean; isTaxable: boolean }): ComponentRow {
    return { _key: this._rowKey++, name: c.name, type: c.type, monthlyAmount: c.monthlyAmount, isBasic: c.isBasic, isTaxable: c.isTaxable };
  }

  addRow(type: 'earning' | 'deduction', isBasic = false): void {
    this.rows.update(r => [...r, { _key: this._rowKey++, name: '', type, monthlyAmount: 0, isBasic, isTaxable: type === 'earning' }]);
  }

  removeRow(key: number): void {
    this.rows.update(r => r.filter(x => x._key !== key));
  }

  setBasic(key: number): void {
    this.rows.update(r => r.map(x => ({ ...x, isBasic: x.type === 'earning' && x._key === key })));
  }

  saveStructure(): void {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    const body: SetSalaryStructureRequest = {
      payGradeId: this.payGradeId() || null,
      effectiveFrom: this.effectiveFrom(),
      reason: this.reason(),
      notes: this.notes().trim() || undefined,
      components: this.rows().map(r => ({
        name: r.name.trim(), type: r.type, monthlyAmount: Number(r.monthlyAmount) || 0,
        isBasic: !!r.isBasic, isTaxable: !!r.isTaxable,
      })),
      payFrequency: this.payFrequency(),
      weekStart: this.payFrequency() === 'weekly' ? this.weekStart().toLowerCase() : null,
    };
    this.payrollSvc.setStructure(this.userId, body).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.current.set(s);
        this._lastLoadedPayFrequency = s.payFrequency;
        this.editing.set(false);
        this.toast.success('Salary structure saved', `Effective from ${s.effectiveFrom}.`);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.error ?? err?.error?.message ?? 'Please try again.';
        // Weekly payroll is entitlement-gated server-side too — a 403 with this
        // code means the save was rejected because payFrequency was set to
        // 'weekly' without the plan for it. Revert to the last-known-good
        // frequency and surface the upgrade prompt (this is not a session/
        // permission error — no redirect/logout).
        if (err?.status === 403 && err?.error?.code === 'feature_not_in_plan') {
          this.payFrequency.set(this._lastLoadedPayFrequency);
          this.upgradePrompt.open(err?.error?.feature ?? 'weekly_payroll');
        }
        this.toast.error('Could not save', msg);
      },
    });
  }

  // ── Pay-to-Date (current, still-in-progress period) ─────────────────────
  preview = signal<PayslipDto | null>(null);
  previewLoading = signal(true);
  previewError = signal<string | null>(null);

  readonly previewEarningLines = computed(() => this.linesOf('earning', this.preview()));
  readonly previewDeductionLines = computed(() => this.linesOf('deduction', this.preview()));
  readonly previewEmployerLines = computed(() => this.linesOf('employer', this.preview()));

  loadPreview(): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.payrollSvc.getPreview(this.userId).subscribe({
      next: (p) => { this.preview.set(p); this.previewLoading.set(false); },
      error: (err) => {
        this.previewLoading.set(false);
        this.previewError.set(err?.status === 409
          ? (err?.error?.error ?? 'No salary structure set yet — a preview isn\'t available until one is.')
          : 'Could not load the current-period preview.');
      },
    });
  }

  private linesOf(type: PayslipLineType, source: PayslipDto | null) {
    if (!source) return [];
    return source.lines.filter(l => l.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  readonly monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  periodLabel(p: PayslipDto): string {
    if (p.payFrequency === 'weekly' && p.weekStart && p.weekEnd) {
      const s = new Date(p.weekStart), e = new Date(p.weekEnd);
      const fmt = (d: Date) => `${d.getDate()} ${this.monthNames[d.getMonth()].slice(0, 3)}`;
      return `${fmt(s)} – ${fmt(e)}`;
    }
    return `${this.monthNames[p.month - 1]} ${p.year}`;
  }

  // ── Annual Summary ────────────────────────────────────────────────────────
  summaryYear = signal(new Date().getFullYear());
  summary = signal<AnnualSummaryDto | null>(null);
  summaryLoading = signal(true);
  downloadingSummary = signal(false);

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  });
  readonly yearSelectOptions = computed(() => this.yearOptions().map(y => ({ label: String(y), value: y })));

  setSummaryYear(y: number): void {
    this.summaryYear.set(y);
    this.loadSummary();
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.payrollSvc.getAnnualSummary(this.userId, this.summaryYear()).subscribe({
      next: (s) => { this.summary.set(s); this.summaryLoading.set(false); },
      error: () => { this.summary.set(null); this.summaryLoading.set(false); },
    });
  }

  downloadSummaryPdf(): void {
    if (this.downloadingSummary()) return;
    this.downloadingSummary.set(true);
    this.payrollSvc.downloadAnnualSummaryPdf(this.userId, this.summaryYear()).subscribe({
      next: (blob) => {
        this.downloadingSummary.set(false);
        const who = (this.employee()?.fullName ?? this.userId).replace(/\s+/g, '-');
        triggerBlobDownload(blob, `annual-summary-${who}-${this.summaryYear()}.pdf`);
      },
      error: () => { this.downloadingSummary.set(false); this.toast.error('Could not download', 'Please try again.'); },
    });
  }
}
