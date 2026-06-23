import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { DesignationService } from '../../../../core/services/designation.service';
import { OfficeService } from '../../../../core/services/office.service';
import { Department } from '../../../../core/models/department.model';
import { Designation } from '../../../../core/models/designation.model';
import { Office } from '../../../../core/models/office.model';
import { EmployeeResponse } from '../../models/employee-api.model';
import { UiSelectComponent, UiDatePickerComponent } from '../../../../shared/components';

interface EmployeeForm {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
  overrideOfficeId: string;
  dateOfJoining: string;
  isActive: boolean;
}

@Component({
  selector: 'app-employee-add',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent],
  templateUrl: './employee-add.component.html',
  styleUrl: './employee-add.component.scss',
})
export class EmployeeAddComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private designationService = inject(DesignationService);
  private officeService = inject(OfficeService);

  isEdit   = signal(false);
  empId    = signal<string | null>(null);
  loading  = signal(false);
  saved    = signal(false);
  errors   = signal<Record<string, string>>({});
  submitError = signal<string | null>(null);

  /** Shown once after a successful create — never returned by the API again. */
  temporaryPassword = signal<string | null>(null);

  departments  = signal<Department[]>([]);
  designations = signal<Designation[]>([]);
  offices      = signal<Office[]>([]);
  managers     = signal<EmployeeResponse[]>([]);

  readonly roles = ['admin', 'hr', 'manager', 'employee'];
  readonly roleOptions = this.roles.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r }));

  readonly departmentOptions = computed(() => [
    { label: 'No department', value: '' },
    ...this.departments().map(d => ({ label: d.name, value: d.departmentId })),
  ]);
  readonly designationOptions = computed(() => [
    { label: 'No designation', value: '' },
    ...this.designations().map(d => ({ label: d.title, value: d.designationId })),
  ]);
  readonly managerOptions = computed(() => [
    { label: 'No manager', value: '' },
    ...this.managers().map(m => ({ label: `${m.fullName} — ${m.designationTitle || m.role}`, value: m.employeeId })),
  ]);
  readonly officeOptions = computed(() => [
    { label: 'No override', value: '' },
    ...this.offices().map(o => ({ label: o.name, value: o.id })),
  ]);

  form = signal<EmployeeForm>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'employee',
    departmentId: '',
    designationId: '',
    reportingManagerId: '',
    overrideOfficeId: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    isActive: true,
  });

  ngOnInit() {
    this.departmentService.getAll().subscribe({ next: (res) => this.departments.set(res.data ?? []) });
    this.designationService.getAll().subscribe({ next: (res) => this.designations.set(res.data ?? []) });
    this.officeService.getAll().subscribe({ next: (res) => this.offices.set(res.data ?? []) });
    this.employeeService.getAll().subscribe({
      next: (res) => this.managers.set(
        (res.data ?? []).filter(e => e.role === 'admin' || e.role === 'manager' || e.role === 'hr' || e.role === 'super_admin')
      ),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.empId.set(id);
      this.loading.set(true);
      this.employeeService.getById(id).subscribe({
        next: (res) => {
          const emp = res.data;
          this.form.set({
            employeeCode: emp.employeeCode ?? '',
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            phone: emp.phone ?? '',
            role: emp.role,
            departmentId: emp.departmentId ?? '',
            designationId: emp.designationId ?? '',
            reportingManagerId: emp.reportingManagerId ?? '',
            overrideOfficeId: emp.overrideOfficeId ?? '',
            dateOfJoining: emp.dateOfJoining ?? '',
            isActive: emp.isActive,
          });
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); },
      });
    }
  }

  patch(field: keyof EmployeeForm, value: string | boolean) {
    this.form.update(f => ({ ...f, [field]: value }));
    // clear error
    const errs = { ...this.errors() };
    delete errs[field];
    this.errors.set(errs);
  }

  validate(): boolean {
    const f = this.form();
    const errs: Record<string, string> = {};
    if (!f.firstName.trim())   errs['firstName']   = 'First name is required';
    if (!f.lastName.trim())    errs['lastName']     = 'Last name is required';
    if (!this.isEdit()) {
      if (!f.email.trim())     errs['email']        = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs['email'] = 'Invalid email address';
    }
    if (!f.dateOfJoining)      errs['dateOfJoining'] = 'Join date is required';
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  submit() {
    if (!this.validate()) return;
    this.loading.set(true);
    this.submitError.set(null);
    const f = this.form();

    if (this.isEdit()) {
      const id = this.empId()!;
      this.employeeService.update(id, {
        firstName: f.firstName,
        lastName: f.lastName,
        role: f.role as any,
        phone: f.phone || undefined,
        employeeCode: f.employeeCode || undefined,
        departmentId: f.departmentId || null,
        reportingManagerId: f.reportingManagerId || null,
        designationId: f.designationId || null,
        dateOfJoining: f.dateOfJoining || undefined,
        overrideOfficeId: f.overrideOfficeId || null,
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.saved.set(true);
          setTimeout(() => this.orgNav.navigate(['app', 'employees']), 1200);
        },
        error: (err) => {
          this.loading.set(false);
          this.submitError.set(this.extractError(err));
        },
      });
    } else {
      this.employeeService.create({
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        role: f.role as any,
        phone: f.phone || undefined,
        employeeCode: f.employeeCode || undefined,
        departmentId: f.departmentId || null,
        reportingManagerId: f.reportingManagerId || null,
        designationId: f.designationId || null,
        dateOfJoining: f.dateOfJoining || undefined,
        overrideOfficeId: f.overrideOfficeId || null,
      }).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.saved.set(true);
          // temporaryPassword is only ever shown once — surface it instead of discarding.
          if (res.data.temporaryPassword) {
            this.temporaryPassword.set(res.data.temporaryPassword);
          } else {
            setTimeout(() => this.orgNav.navigate(['app', 'employees']), 1200);
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.submitError.set(this.extractError(err));
        },
      });
    }
  }

  private extractError(err: any): string {
    const data = err?.error?.data;
    if (data?.error) {
      const messages = Object.values(data.error).flat();
      if (messages.length) return messages.join(' ');
    }
    return err?.error?.message || 'Something went wrong. Please try again.';
  }

  doneAfterPasswordShown() {
    this.orgNav.navigate(['app', 'employees']);
  }

  cancel() { this.orgNav.navigate(['app', 'employees']); }
}
