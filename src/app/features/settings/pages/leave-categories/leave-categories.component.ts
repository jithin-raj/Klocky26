import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveCategoryService } from '../../../../core/services/leave-category.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { LeaveCategory, LeaveCategoryUpsert } from '../../../../core/models/leave-category.model';

interface NewCategoryForm {
  name: string;
  code: string;
  daysPerYear: number;
  accrualType: 'upfront' | 'monthly' | 'joining_anniversary' | 'manual';
  isPaid: boolean;
  isHalfDayAllowed: boolean;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  requiresApproval: boolean;
  approvalFlow: 'manager' | 'hr' | 'manager_then_hr' | 'any_management';
  genderEligibility: 'all' | 'male' | 'female' | 'other';
  isCompOff: boolean;
}

function defaultForm(): NewCategoryForm {
  return {
    name: '',
    code: '',
    daysPerYear: 0,
    accrualType: 'upfront',
    isPaid: true,
    isHalfDayAllowed: true,
    allowCarryForward: false,
    maxCarryForwardDays: 0,
    requiresApproval: true,
    approvalFlow: 'manager',
    genderEligibility: 'all',
    isCompOff: false,
  };
}

@Component({
  selector: 'app-leave-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-categories.component.html',
  styleUrl: './leave-categories.component.scss',
})
export class LeaveCategoriesComponent implements OnInit {
  private readonly catSvc = inject(LeaveCategoryService);
  private readonly toast = inject(ToastService);

  categories = signal<LeaveCategory[]>([]);
  loading = signal(true);
  showAddForm = signal(false);
  submitting = signal(false);
  busyId = signal<string | null>(null);

  form: NewCategoryForm = defaultForm();

  readonly accrualTypeOptions = [
    { value: 'upfront', label: 'Upfront' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'joining_anniversary', label: 'Joining Anniversary' },
    { value: 'manual', label: 'Manual' },
  ];

  readonly approvalFlowOptions = [
    { value: 'manager', label: 'Manager' },
    { value: 'hr', label: 'HR' },
    { value: 'manager_then_hr', label: 'Manager then HR' },
    { value: 'any_management', label: 'Any Management' },
  ];

  readonly genderOptions = [
    { value: 'all', label: 'All' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.catSvc.getAll(true).subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load', 'Could not load leave categories.');
      },
    });
  }

  toggleAddForm(): void {
    this.showAddForm.update(v => !v);
    if (!this.showAddForm()) this.form = defaultForm();
  }

  submitCreate(): void {
    if (!this.form.name.trim() || this.form.daysPerYear == null) return;
    this.submitting.set(true);

    const body: LeaveCategoryUpsert = {
      name: this.form.name.trim(),
      code: this.form.code.trim() || undefined as any,
      color: undefined as any,
      description: undefined as any,
      daysPerYear: this.form.daysPerYear,
      accrualType: this.form.accrualType,
      accrualDayOfMonth: 1,
      isPaid: this.form.isPaid,
      isHalfDayAllowed: this.form.isHalfDayAllowed,
      allowCarryForward: this.form.allowCarryForward,
      maxCarryForwardDays: this.form.allowCarryForward ? this.form.maxCarryForwardDays : 0,
      encashOnLapse: false,
      countWeekendInLeave: false,
      countHolidaysInLeave: false,
      minDaysPerApplication: 1,
      minAdvanceNoticeDays: 0,
      allowBackdatedApplication: false,
      documentRequired: false,
      requiresApproval: this.form.requiresApproval,
      approvalFlow: this.form.approvalFlow,
      eligibleAfterDays: 0,
      genderEligibility: this.form.genderEligibility,
      applicableDepartments: [],
      applicableOffices: [],
      applicableRoles: [],
      allowEncashment: false,
      maxEncashmentDaysPerYear: 0,
      resetCycle: 'calendar_year',
      calendarYearResetMonth: 1,
      calendarYearResetDay: 1,
      isCompOff: this.form.isCompOff,
      isActive: true,
      sortOrder: 0,
    };

    this.catSvc.create(body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showAddForm.set(false);
        this.form = defaultForm();
        this.toast.success('Created', `Leave category "${body.name}" created.`);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(
          'Create failed',
          err?.error?.message ?? 'Could not create leave category.',
        );
      },
    });
  }

  toggleActive(cat: LeaveCategory): void {
    this.busyId.set(cat.id);
    this.catSvc.update(cat.id, { isActive: !cat.isActive }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('Updated', `${cat.name} is now ${!cat.isActive ? 'active' : 'inactive'}.`);
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error('Update failed', err?.error?.message ?? 'Could not update status.');
      },
    });
  }

  deleteCategory(cat: LeaveCategory): void {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    this.busyId.set(cat.id);
    this.catSvc.delete(cat.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('Deleted', `"${cat.name}" was deleted.`);
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error('Delete failed', err?.error?.message ?? 'Could not delete category.');
      },
    });
  }

  accrualLabel(type: string): string {
    return this.accrualTypeOptions.find(o => o.value === type)?.label ?? type;
  }

  approvalLabel(flow: string): string {
    return this.approvalFlowOptions.find(o => o.value === flow)?.label ?? flow;
  }
}
