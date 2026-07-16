import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PayrollService } from '../../../../core/services/payroll.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { UiDatePickerComponent } from '../../../../shared/components/ui-datepicker/ui-datepicker.component';
import {
  SalaryStructureDto, SetSalaryStructureRequest, SalaryComponentInput, SalaryStructureReason,
  PayGradeDto, BonusDto,
} from '../../../../core/models/payroll.model';
import { EmployeeResponse } from '../../../employees/models/employee-api.model';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';

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
      next: (s) => { this.current.set(s); this.loading.set(false); },
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
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
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
    };
    this.payrollSvc.setStructure(this.userId, body).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.current.set(s);
        this.editing.set(false);
        this.toast.success('Salary structure saved', `Effective from ${s.effectiveFrom}.`);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Could not save', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }
}
