import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollService } from '../../../../core/services/payroll.service';
import { LocalizationService } from '../../../../core/services/localization.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  UiSelectComponent, UiInputComponent, UiToggleComponent,
  UiDataGridComponent, GridColumn, GridAction,
  UiFormModalComponent, UiFormGridComponent, UiFormFieldComponent,
  UiPaginationComponent, SelectOption,
} from '../../../../shared/components';
import {
  PayrollSettingsDto, PayGradeDto, PayGradeUpsertRequest, BonusDto, PayslipDto, PayslipRunResult,
} from '../../../../core/models/payroll.model';
import { EmployeeResponse } from '../../../employees/models/employee-api.model';

const AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9'];
function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

type Tab = 'settings' | 'grades' | 'employees' | 'bonuses' | 'payslips';

interface GradeForm {
  id: string | null;
  name: string; code: string; minCtc: number; midCtc: number; maxCtc: number; isActive: boolean; sortOrder: number;
}

interface BonusForm { userId: string; year: number; month: number; amount: number; label: string; notes: string; }

@Component({
  selector: 'app-compensation-hub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, UiSelectComponent, UiInputComponent, UiToggleComponent,
    UiDataGridComponent, UiPaginationComponent,
    UiFormModalComponent, UiFormGridComponent, UiFormFieldComponent,
  ],
  templateUrl: './compensation-hub.component.html',
  styleUrl: './compensation-hub.component.scss',
})
export class CompensationHubComponent implements OnInit {
  private readonly payrollSvc = inject(PayrollService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly permissions = inject(PermissionService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);
  private readonly loc   = inject(LocalizationService);

  readonly canEdit = computed(() => this.permissions.can('payroll', 2));

  activeTab = signal<Tab>('employees');
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'employees', label: 'Employees' },
    { id: 'grades',    label: 'Pay Grades' },
    { id: 'bonuses',   label: 'Bonuses' },
    { id: 'payslips',  label: 'Run Payroll' },
    { id: 'settings',  label: 'Settings' },
  ];

  employees = signal<EmployeeResponse[]>([]);
  employeeSearch = signal('');
  readonly filteredEmployees = computed(() => {
    const q = this.employeeSearch().trim().toLowerCase();
    const list = this.employees();
    if (!q) return list;
    return list.filter(e => e.fullName.toLowerCase().includes(q) || (e.employeeCode ?? '').toLowerCase().includes(q));
  });

  // ── Pagination (same client-side pattern as the Employee Listing page) ─────
  employeePage     = signal(1);
  employeePageSize = signal(10);
  readonly employeePageSizeOptions: SelectOption[] = [10, 25, 50].map(n => ({ label: `${n} / page`, value: n }));
  readonly employeeTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEmployees().length / this.employeePageSize())));
  readonly pagedEmployees = computed(() => {
    const start = (this.employeePage() - 1) * this.employeePageSize();
    return this.filteredEmployees().slice(start, start + this.employeePageSize());
  });
  readonly employeeStartResult = computed(() => (this.employeePage() - 1) * this.employeePageSize() + 1);
  readonly employeeEndResult   = computed(() =>
    Math.min(this.employeePage() * this.employeePageSize(), this.filteredEmployees().length));

  setEmployeePage(p: number): void {
    if (p >= 1 && p <= this.employeeTotalPages()) this.employeePage.set(p);
  }
  setEmployeePageSize(n: number): void {
    this.employeePageSize.set(n);
    this.employeePage.set(1);
  }
  setEmployeeSearch(v: string): void {
    this.employeeSearch.set(v);
    this.employeePage.set(1);
  }

  // ── Grid column / action definitions (shared ui-data-grid) ─────────────────
  readonly employeeTrackBy = (e: EmployeeResponse) => e.employeeId;
  readonly employeeColumns: GridColumn<EmployeeResponse>[] = [
    {
      key: 'fullName', label: 'Employee', sortable: true, type: 'avatar',
      avatarInitials: (r) => initialsOf(r.fullName),
      avatarColor: (r) => colorFor(r.employeeId),
      primaryText: (r) => r.fullName,
      secondaryText: (r) => r.email,
      tertiaryText: (r) => r.employeeCode || '',
    },
    { key: 'departmentName', label: 'Department', type: 'text', value: (r) => r.departmentName || r.orgRoleName || '—' },
  ];
  readonly employeeActions: GridAction<EmployeeResponse>[] = [
    { label: 'Manage salary', visible: () => this.canEdit(), click: (r) => this.openEmployee(r.employeeId) },
    { label: 'View salary', visible: () => !this.canEdit(), click: (r) => this.openEmployee(r.employeeId) },
  ];

  readonly gradeColumns: GridColumn<PayGradeDto>[] = [
    { key: 'name', label: 'Grade', type: 'text-pair', primaryText: (r) => r.name, secondaryText: (r) => r.code || '' },
    { key: 'minCtc', label: 'Min CTC', type: 'text', value: (r) => this.num(r.minCtc) },
    { key: 'midCtc', label: 'Mid CTC', type: 'text', value: (r) => this.num(r.midCtc) },
    { key: 'maxCtc', label: 'Max CTC', type: 'text', value: (r) => this.num(r.maxCtc) },
    {
      key: 'isActive', label: 'Status', type: 'badge',
      value: (r) => r.isActive ? 'Active' : 'Inactive',
      badgeBg: (v) => v === 'Active' ? '#dcfce7' : '#f1f5f9',
      badgeColor: (v) => v === 'Active' ? '#15803d' : '#64748b',
    },
  ];
  readonly gradeActions: GridAction<PayGradeDto>[] = [
    { label: 'Edit', visible: () => this.canEdit(), click: (g) => this.openEditGrade(g) },
    { label: 'Delete', danger: true, visible: () => this.canEdit(), click: (g) => this.deleteGrade(g) },
  ];

  readonly bonusColumns: GridColumn<BonusDto>[] = [
    { key: 'employeeName', label: 'Employee', type: 'text', value: (r) => r.employeeName },
    { key: 'period', label: 'Period', type: 'text', value: (r) => `${this.monthNames[r.month - 1]} ${r.year}` },
    { key: 'amount', label: 'Amount', type: 'text', value: (r) => this.num(r.amount) },
    { key: 'label', label: 'Label', type: 'text', value: (r) => r.label || '—' },
  ];
  readonly bonusActions: GridAction<BonusDto>[] = [
    { label: 'Delete', danger: true, visible: () => this.canEdit(), click: (b) => this.deleteBonus(b) },
  ];

  readonly payslipColumns: GridColumn<PayslipDto>[] = [
    { key: 'employeeName', label: 'Employee', type: 'text', value: (r) => r.employeeName },
    { key: 'grossEarnings', label: 'Gross', type: 'text', value: (r) => this.num(r.grossEarnings) },
    { key: 'totalDeductions', label: 'Deductions', type: 'text', value: (r) => this.num(r.totalDeductions) },
    { key: 'netPay', label: 'Net Pay', type: 'text', value: (r) => this.num(r.netPay) },
    { key: 'days', label: 'Payable / LOP', type: 'text', value: (r) => `${r.payableDays} / ${r.lopDays}` },
    {
      key: 'status', label: 'Status', type: 'badge',
      value: (r) => r.status,
      badgeBg: () => '#eef2ff', badgeColor: () => '#4338ca',
    },
  ];

  /** All the columns this feeds (CTC bands, bonus amount, payslip totals) are org-wide money. */
  private num(v: number): string {
    return this.loc.formatCurrency(v ?? 0);
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadSettings();
    this.loadGrades();
    this.loadBonuses();
  }

  selectTab(t: Tab): void {
    this.activeTab.set(t);
    if (t === 'payslips' && !this.payslips().length) this.loadPayslips();
  }

  loadEmployees(): void {
    this.employeeSvc.getAll().subscribe({
      next: (res) => this.employees.set(res.data ?? []),
      error: () => this.employees.set([]),
    });
  }

  openEmployee(id: string): void {
    this.orgNav.navigate(['app', 'compensation', 'employee', id]);
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  settings = signal<PayrollSettingsDto | null>(null);
  loadingSettings = signal(true);
  savingSettings = signal(false);

  loadSettings(): void {
    this.loadingSettings.set(true);
    this.payrollSvc.getSettings().subscribe({
      next: (s) => { this.settings.set(s); this.loadingSettings.set(false); },
      error: () => { this.loadingSettings.set(false); },
    });
  }

  saveSettings(): void {
    const s = this.settings();
    if (!s || this.savingSettings()) return;
    this.savingSettings.set(true);
    this.payrollSvc.updateSettings(s).subscribe({
      next: (res) => { this.settings.set(res); this.savingSettings.set(false); this.toast.success('Settings saved', 'Statutory settings updated.'); },
      error: (err) => { this.savingSettings.set(false); this.toast.error('Could not save', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  // ── Pay grades ────────────────────────────────────────────────────────────
  grades = signal<PayGradeDto[]>([]);
  loadingGrades = signal(true);
  gradeEditorOpen = signal(false);
  gradeBusy = signal(false);
  gradeForm: GradeForm = this.blankGrade();

  private blankGrade(): GradeForm {
    return { id: null, name: '', code: '', minCtc: 0, midCtc: 0, maxCtc: 0, isActive: true, sortOrder: this.grades().length };
  }

  loadGrades(): void {
    this.loadingGrades.set(true);
    this.payrollSvc.getGrades().subscribe({
      next: (g) => { this.grades.set([...g].sort((a, b) => a.sortOrder - b.sortOrder)); this.loadingGrades.set(false); },
      error: () => { this.loadingGrades.set(false); },
    });
  }

  openNewGrade(): void { this.gradeForm = this.blankGrade(); this.gradeEditorOpen.set(true); }
  openEditGrade(g: PayGradeDto): void {
    this.gradeForm = { id: g.id, name: g.name, code: g.code ?? '', minCtc: g.minCtc, midCtc: g.midCtc, maxCtc: g.maxCtc, isActive: g.isActive, sortOrder: g.sortOrder };
    this.gradeEditorOpen.set(true);
  }
  closeGradeEditor(): void { this.gradeEditorOpen.set(false); }

  get gradeValid(): boolean {
    return !!this.gradeForm.name.trim() && this.gradeForm.minCtc <= this.gradeForm.midCtc && this.gradeForm.midCtc <= this.gradeForm.maxCtc;
  }

  saveGrade(): void {
    if (!this.gradeValid || this.gradeBusy()) return;
    this.gradeBusy.set(true);
    const body: PayGradeUpsertRequest = {
      name: this.gradeForm.name.trim(), code: this.gradeForm.code.trim() || undefined,
      minCtc: this.gradeForm.minCtc, midCtc: this.gradeForm.midCtc, maxCtc: this.gradeForm.maxCtc,
      isActive: this.gradeForm.isActive, sortOrder: this.gradeForm.sortOrder,
    };
    const req$ = this.gradeForm.id ? this.payrollSvc.updateGrade(this.gradeForm.id, body) : this.payrollSvc.createGrade(body);
    req$.subscribe({
      next: () => { this.gradeBusy.set(false); this.gradeEditorOpen.set(false); this.toast.success(this.gradeForm.id ? 'Grade updated' : 'Grade created'); this.loadGrades(); },
      error: (err) => { this.gradeBusy.set(false); this.toast.error('Could not save grade', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  deleteGrade(g: PayGradeDto): void {
    if (this.gradeBusy()) return;
    if (!window.confirm(`Delete pay grade "${g.name}"?`)) return;
    this.gradeBusy.set(true);
    this.payrollSvc.deleteGrade(g.id).subscribe({
      next: () => { this.gradeBusy.set(false); this.toast.success('Grade deleted'); this.loadGrades(); },
      error: (err) => {
        this.gradeBusy.set(false);
        if (err?.status === 409) this.toast.error('Can\'t delete this grade', 'Employees are assigned to it. Deactivate it instead.');
        else this.toast.error('Could not delete', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Bonuses ───────────────────────────────────────────────────────────────
  bonuses = signal<BonusDto[]>([]);
  loadingBonuses = signal(true);
  bonusEditorOpen = signal(false);
  bonusBusy = signal(false);
  readonly now = new Date();
  bonusForm: BonusForm = this.blankBonus();

  private blankBonus(): BonusForm {
    return { userId: '', year: this.now.getFullYear(), month: this.now.getMonth() + 1, amount: 0, label: '', notes: '' };
  }

  readonly employeeOptions = computed(() => this.employees().map(e => ({ label: `${e.fullName}${e.employeeCode ? ' · ' + e.employeeCode : ''}`, value: e.employeeId })));

  loadBonuses(): void {
    this.loadingBonuses.set(true);
    this.payrollSvc.getBonuses().subscribe({
      next: (b) => { this.bonuses.set(b); this.loadingBonuses.set(false); },
      error: () => { this.loadingBonuses.set(false); },
    });
  }

  openNewBonus(): void { this.bonusForm = this.blankBonus(); this.bonusEditorOpen.set(true); }
  closeBonusEditor(): void { this.bonusEditorOpen.set(false); }

  get bonusValid(): boolean {
    return !!this.bonusForm.userId && this.bonusForm.amount > 0 && this.bonusForm.year > 0 && this.bonusForm.month >= 1 && this.bonusForm.month <= 12;
  }

  saveBonus(): void {
    if (!this.bonusValid || this.bonusBusy()) return;
    this.bonusBusy.set(true);
    this.payrollSvc.createBonus({
      userId: this.bonusForm.userId, year: this.bonusForm.year, month: this.bonusForm.month,
      amount: this.bonusForm.amount, label: this.bonusForm.label.trim() || undefined, notes: this.bonusForm.notes.trim() || undefined,
    }).subscribe({
      next: () => { this.bonusBusy.set(false); this.bonusEditorOpen.set(false); this.toast.success('Bonus added'); this.loadBonuses(); },
      error: (err) => { this.bonusBusy.set(false); this.toast.error('Could not add bonus', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  deleteBonus(b: BonusDto): void {
    if (this.bonusBusy()) return;
    if (!window.confirm(`Delete this bonus for ${b.employeeName}?`)) return;
    this.bonusBusy.set(true);
    this.payrollSvc.deleteBonus(b.id).subscribe({
      next: () => { this.bonusBusy.set(false); this.toast.success('Bonus deleted'); this.loadBonuses(); },
      error: (err) => { this.bonusBusy.set(false); this.toast.error('Could not delete', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  // ── Run payroll / payslips ────────────────────────────────────────────────
  payslips = signal<PayslipDto[]>([]);
  loadingPayslips = signal(false);
  generating = signal(false);
  runYear = signal(this.now.getFullYear());
  runMonth = signal(this.now.getMonth() + 1);
  lastRunResult = signal<PayslipRunResult | null>(null);

  loadPayslips(): void {
    this.loadingPayslips.set(true);
    this.payrollSvc.getPayslips(this.runYear(), this.runMonth()).subscribe({
      next: (p) => { this.payslips.set(p); this.loadingPayslips.set(false); },
      error: () => { this.loadingPayslips.set(false); },
    });
  }

  runPayrollForOrg(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.lastRunResult.set(null);
    this.payrollSvc.generatePayslips({ year: this.runYear(), month: this.runMonth() }).subscribe({
      next: (res) => {
        this.generating.set(false);
        if ('generated' in res) {
          this.lastRunResult.set(res);
          this.toast.success('Payroll run complete', `${res.generated} payslip(s) generated, ${res.skipped} skipped.`);
        }
        this.loadPayslips();
      },
      error: (err) => { this.generating.set(false); this.toast.error('Payroll run failed', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  totalNet(): number {
    return this.payslips().reduce((sum, p) => sum + p.netPay, 0);
  }

  readonly monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  readonly monthOptions = this.monthNames.map((label, i) => ({ label, value: i + 1 }));
}
