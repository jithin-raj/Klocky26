import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { OfficeService } from '../../../../core/services/office.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { Department } from '../../../../core/models/department.model';
import { Office } from '../../../../core/models/office.model';
import { OrgRole } from '../../../../core/models/org-role.model';
import { EmployeeResponse } from '../../models/employee-api.model';
import {
  UiSelectComponent, UiDatePickerComponent, UiInputComponent, UiToggleComponent,
  UiFormSectionComponent, UiFormGridComponent, UiFormFieldComponent, UiSaveBarComponent,
} from '../../../../shared/components';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';
import { isValidName, NAME_VALIDATION_MESSAGE } from '../../../../core/utils/name-validation.util';

interface EmployeeForm {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;           // add-only; optional; ≥8 if provided
  phone: string;
  role: string;
  employmentType: string;
  departmentId: string;
  orgRoleId: string;
  reportingManagerId: string;
  overrideOfficeId: string;
  dateOfJoining: string;
  dateOfLeaving: string;      // edit-only; exit date
  isActive: boolean;
  isGuest: boolean;
  guestExpiresAt: string;
  gender: 'male' | 'female' | 'other' | '';
  dateOfBirth: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

type EmployeeTab = 'general' | 'classification';

@Component({
  selector: 'app-employee-add',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent,
    UiInputComponent, UiToggleComponent,
    UiFormSectionComponent, UiFormGridComponent, UiFormFieldComponent, UiSaveBarComponent,
  ],
  templateUrl: './employee-add.component.html',
  styleUrl: './employee-add.component.scss',
})
export class EmployeeAddComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private officeService = inject(OfficeService);
  private orgRoleService = inject(OrgRoleService);
  private toast = inject(ToastService);

  isEdit      = signal(false);
  empId       = signal<string | null>(null);
  loading     = signal(false);
  saved       = signal(false);
  showPassword = signal(false);
  errors      = signal<Record<string, string>>({});
  submitError = signal<string | null>(null);

  // ── Tabs ──────────────────────────────────────────────────────
  tab = signal<EmployeeTab>('general');

  setTab(t: EmployeeTab) {
    this.tab.set(t);
  }

  /** Shown once after a successful create — never returned by the API again. */
  temporaryPassword = signal<string | null>(null);

  departments  = signal<Department[]>([]);
  offices      = signal<Office[]>([]);
  managers     = signal<EmployeeResponse[]>([]);
  orgRoles     = signal<OrgRole[]>([]);

  // Access role is no longer shown on the form — the form defaults role to
  // 'employee' and still sends it until the backend makes `role` optional/derived.

  readonly genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
  ];

  readonly employmentTypeOptions = [
    { label: 'Full-time', value: 'full_time' },
    { label: 'Part-time', value: 'part_time' },
    { label: 'Permanent', value: 'permanent' },
    { label: 'Contract', value: 'contract' },
    { label: 'Intern', value: 'intern' },
  ];

  readonly departmentOptions = computed(() => [
    { label: 'No department', value: '' },
    ...this.departments().map(d => ({ label: d.name, value: d.departmentId })),
  ]);
  /**
   * Reporting-manager candidates — anyone MORE SENIOR than the employee in the
   * org hierarchy, ORG-WIDE (not just the employee's department: a CEO/VP may
   * not belong to any department). Convention: lower hierarchyLevel = more
   * senior, so a manager's level must be strictly LOWER than the employee's
   * chosen org role — EXCEPT at the org's top level (e.g. L1), where nobody
   * is strictly senior; there, peers at that same top level are listed too
   * (co-founders/board members reporting to one another), otherwise an L1
   * employee could never be assigned any manager at all. Listed most-senior-first.
   */
  readonly managerOptions = computed(() => {
    const f = this.form();
    const selfId = this.empId();
    // Only org-role holders (people in the hierarchy) can be reporting managers.
    let pool = this.managers().filter(m => m.employeeId !== selfId && m.isActive && m.orgRoleId != null);

    // Strictly more senior (lower level) than the employee's selected role —
    // unless that role IS the org's top level, where same-level peers count too.
    const selectedRole = this.orgRoles().find(r => r.id === f.orgRoleId);
    if (selectedRole) {
      const topLevel = Math.min(...this.orgRoles().map(r => r.hierarchyLevel));
      const isTopLevel = selectedRole.hierarchyLevel === topLevel;
      pool = pool.filter(m => {
        const lvl = m.orgRoleHierarchyLevel ?? Infinity;
        return isTopLevel ? lvl <= selectedRole.hierarchyLevel : lvl < selectedRole.hierarchyLevel;
      });
    }

    // Most senior first (lowest level), then name.
    const sorted = [...pool].sort((a, b) => {
      const la = a.orgRoleHierarchyLevel ?? Infinity;
      const lb = b.orgRoleHierarchyLevel ?? Infinity;
      return la !== lb ? la - lb : a.fullName.localeCompare(b.fullName);
    });

    return [
      { label: 'No manager', value: '' },
      ...sorted.map(m => ({
        label: `${m.fullName} — ${m.orgRoleName || m.designationTitle || m.role}`,
        value: m.employeeId,
      })),
    ];
  });
  /** Explains an empty Reporting-manager dropdown (filtered client-side, not API-loaded). */
  readonly managerHint = computed(() => {
    const f = this.form();
    if (this.managerOptions().length > 1) return '';
    if (f.orgRoleId) return 'No one more senior in the hierarchy to report to.';
    return 'Pick an org role to see who outranks this employee.';
  });

  readonly officeOptions = computed(() => [
    { label: 'No override', value: '' },
    ...this.offices().map(o => ({ label: o.name, value: o.id })),
  ]);
  /**
   * Org roles for the picker — scoped to the selected department (roles mapped
   * to it, plus department-less roles that span all departments, e.g. CEO).
   * Sorted most-senior-first (lower hierarchyLevel = more senior).
   */
  readonly orgRoleOptions = computed(() => {
    const deptId = this.form().departmentId;
    return [
      { label: 'Select a role…', value: '' },
      ...[...this.orgRoles()]
        .filter(r => !deptId || !r.departmentId || r.departmentId === deptId)
        .sort((a, b) => a.hierarchyLevel - b.hierarchyLevel)
        .map(r => ({ label: `${r.name} (L${r.hierarchyLevel})`, value: r.id })),
    ];
  });

  form = signal<EmployeeForm>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: 'employee',
    employmentType: 'full_time',
    departmentId: '',
    orgRoleId: '',
    reportingManagerId: '',
    overrideOfficeId: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    dateOfLeaving: '',
    isActive: true,
    isGuest: false,
    guestExpiresAt: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  // ── Dirty tracking (floating save bar) ─────────────────────────
  private readonly pristine = signal('');
  /** True when the form differs from the last-saved/loaded snapshot. */
  readonly isDirty = computed(() => !!this.pristine() && JSON.stringify(this.form()) !== this.pristine());
  private snapshot() { this.pristine.set(JSON.stringify(this.form())); }
  discardChanges() {
    if (!this.pristine()) return;
    this.form.set(JSON.parse(this.pristine()));
    this.errors.set({});
    this.submitError.set(null);
  }

  ngOnInit() {
    // Lookups degrade independently — a single unavailable endpoint (e.g. the
    // designations route currently 404s on the backend) just leaves that
    // dropdown empty instead of breaking the whole form.
    this.departmentService.getAll().subscribe({ next: (res) => this.departments.set(res.data ?? []), error: () => {} });
    this.officeService.getAll().subscribe({ next: (res) => this.offices.set(res.data ?? []), error: () => {} });
    this.orgRoleService.getAll().subscribe({ next: (res) => this.orgRoles.set(res.data ?? []), error: () => {} });
    // Manager candidates are any active colleague — "manager" is a reporting
    // relationship, not a fixed set of roles — then narrowed to the selected
    // department by managerOptions() above.
    this.employeeService.getAll().subscribe({
      next: (res) => this.managers.set(res.data ?? []),
      error: () => { /* picker stays empty + hint explains; manager is optional */ },
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
            password: '',   // never pre-filled on edit
            phone: emp.phone ?? '',
            role: emp.role,
            employmentType: emp.employmentType ?? 'full_time',
            departmentId: emp.departmentId ?? '',
            orgRoleId: emp.orgRoleId ?? '',
            reportingManagerId: emp.reportingManagerId ?? '',
            overrideOfficeId: emp.overrideOfficeId ?? '',
            dateOfJoining: emp.dateOfJoining ?? '',
            dateOfLeaving: emp.dateOfLeaving ?? '',
            isActive: emp.isActive,
            isGuest: emp.isGuest ?? false,
            guestExpiresAt: (emp as any).guestExpiresAt ?? '',
            gender: emp.gender ?? '',
            dateOfBirth: emp.dateOfBirth ?? '',
            address: emp.address ?? '',
            emergencyContactName: emp.emergencyContactName ?? '',
            emergencyContactPhone: emp.emergencyContactPhone ?? '',
          });
          this.loading.set(false);
          this.snapshot();
        },
        error: () => { this.loading.set(false); },
      });
    } else {
      // Create mode — snapshot the empty defaults so the save bar appears on first change.
      this.snapshot();
    }
  }

  patch(field: keyof EmployeeForm, value: string | boolean) {
    this.form.update(f => {
      const next = { ...f, [field]: value };
      // Manager candidates are scoped by department + org-role seniority — once
      // either changes, a previously-picked manager may no longer be valid, so
      // clear it rather than submit a stale value.
      if (field === 'departmentId' || field === 'orgRoleId') {
        next.reportingManagerId = '';
      }
      // Org roles are department-scoped — changing the department invalidates the role.
      if (field === 'departmentId') {
        next.orgRoleId = '';
      }
      return next;
    });
    const errs = { ...this.errors() };
    delete errs[field];
    if (field === 'departmentId' || field === 'orgRoleId') {
      // Classification needs a department OR an org role — clear both errors when either is touched.
      delete errs['departmentId'];
      delete errs['orgRoleId'];
      delete errs['reportingManagerId'];
    }
    this.errors.set(errs);
  }

  validate(): boolean {
    const f = this.form();
    const errs: Record<string, string> = {};
    if (!f.employeeCode.trim()) errs['employeeCode'] = 'Employee code is required';
    if (!f.firstName.trim())   errs['firstName']   = 'First name is required';
    else if (!isValidName(f.firstName)) errs['firstName'] = NAME_VALIDATION_MESSAGE;
    if (!f.lastName.trim())    errs['lastName']     = 'Last name is required';
    else if (!isValidName(f.lastName)) errs['lastName'] = NAME_VALIDATION_MESSAGE;
    if (!this.isEdit()) {
      if (!f.gender)           errs['gender']       = 'Gender is required';
      if (!f.email.trim())     errs['email']        = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs['email'] = 'Invalid email address';
      if (f.password && f.password.length < 8)  errs['password'] = 'Password must be at least 8 characters';
    }
    if (!f.dateOfJoining)      errs['dateOfJoining'] = 'Join date is required';
    if (!f.departmentId)       errs['departmentId'] = 'Department is required';
    if (f.emergencyContactName.trim() && !isValidName(f.emergencyContactName)) {
      errs['emergencyContactName'] = NAME_VALIDATION_MESSAGE;
    }

    // Duplicate pre-check against the loaded roster — fail fast before saving.
    const roster = this.managers();
    const selfId = this.empId();
    const code = f.employeeCode.trim().toLowerCase();
    if (code && !errs['employeeCode'] && roster.some(m => m.employeeId !== selfId && (m.employeeCode || '').toLowerCase() === code)) {
      errs['employeeCode'] = 'This employee code is already in use';
    }
    if (!this.isEdit() && f.email.trim() && !errs['email']) {
      const email = f.email.trim().toLowerCase();
      if (roster.some(m => (m.email || '').toLowerCase() === email)) {
        errs['email'] = 'An employee with this email already exists';
      }
    }

    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  /** Jump to whichever tab holds the first validation error, then scroll to it. */
  private focusErrorTab() {
    const e = this.errors();
    const general = ['employeeCode', 'firstName', 'lastName', 'gender', 'email', 'password', 'dateOfJoining'];
    if (general.some(k => e[k])) { this.tab.set('general'); }
    else if (e['departmentId'] || e['orgRoleId']) { this.tab.set('classification'); }
    // Scroll to the first visible error after Angular renders the tab
    setTimeout(() => {
      const errEl = document.querySelector('.uff-error') as HTMLElement | null;
      if (errEl) {
        errEl.closest('.uff')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = (errEl.closest('.uff') as HTMLElement)
          ?.querySelector<HTMLElement>('input:not([disabled]),button:not([disabled])');
        focusable?.focus({ preventScroll: true });
      }
    }, 60);
  }

  submit() {
    if (!this.validate()) { this.focusErrorTab(); return; }
    this.loading.set(true);
    this.submitError.set(null);
    const f = this.form();

    if (this.isEdit()) {
      const id = this.empId()!;
      this.employeeService.update(id, {
        firstName: f.firstName,
        lastName: f.lastName,
        role: f.role as any,
        employmentType: (f.employmentType || undefined) as any,
        phone: f.phone || undefined,
        employeeCode: f.employeeCode || undefined,
        departmentId: f.departmentId || null,
        orgRoleId: f.orgRoleId || null,
        reportingManagerId: f.reportingManagerId || null,
        dateOfJoining: f.dateOfJoining || undefined,
        dateOfLeaving: f.dateOfLeaving || undefined,
        overrideOfficeId: f.overrideOfficeId || null,
        isGuest: f.isGuest,
        guestExpiresAt: f.guestExpiresAt || undefined,
        ...(f.gender ? { gender: f.gender as 'male' | 'female' | 'other' } : {}),
        dateOfBirth: f.dateOfBirth || undefined,
        address: f.address || undefined,
        emergencyContactName: f.emergencyContactName || undefined,
        emergencyContactPhone: f.emergencyContactPhone || undefined,
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.saved.set(true);
          this.snapshot();
          this.toast.success('Employee updated', 'Profile saved successfully.');
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
        password: f.password || undefined,
        firstName: f.firstName,
        lastName: f.lastName,
        role: f.role as any,
        employmentType: (f.employmentType || undefined) as any,
        phone: f.phone || undefined,
        employeeCode: f.employeeCode || undefined,
        departmentId: f.departmentId || null,
        orgRoleId: f.orgRoleId || null,
        reportingManagerId: f.reportingManagerId || null,
        dateOfJoining: f.dateOfJoining || undefined,
        overrideOfficeId: f.overrideOfficeId || null,
        isGuest: f.isGuest,
        guestExpiresAt: f.guestExpiresAt || undefined,
        gender: f.gender as 'male' | 'female' | 'other',
        dateOfBirth: f.dateOfBirth || undefined,
        address: f.address || undefined,
        emergencyContactName: f.emergencyContactName || undefined,
        emergencyContactPhone: f.emergencyContactPhone || undefined,
      }).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.saved.set(true);
          this.snapshot();
          this.toast.success('Employee added', `${f.firstName} ${f.lastName} was created successfully.`);
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
    return extractApiErrorMessage(err);
  }

  doneAfterPasswordShown() {
    this.orgNav.navigate(['app', 'employees']);
  }

  cancel() { this.orgNav.navigate(['app', 'employees']); }
}
