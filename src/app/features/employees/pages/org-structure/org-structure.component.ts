import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../../../core/services/department.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { ModalService } from '../../../../shared/components/ui-modal/modal.service';
import { Department } from '../../../../core/models/department.model';
import { OrgRole } from '../../../../core/models/org-role.model';
import { EmployeeResponse } from '../../models/employee-api.model';
import {
  UiFormModalComponent, UiFormGridComponent, UiFormFieldComponent,
  UiInputComponent, UiSelectComponent, SelectOption,
  UiDataGridComponent, GridColumnTemplateDirective, GridColumn, UiPaginationComponent,
} from '../../../../shared/components';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';

type Tab = 'departments' | 'roles';

@Component({
  selector: 'app-org-structure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    UiFormModalComponent, UiFormGridComponent, UiFormFieldComponent,
    UiInputComponent, UiSelectComponent, UiDataGridComponent,
    GridColumnTemplateDirective, UiPaginationComponent,
  ],
  templateUrl: './org-structure.component.html',
  styleUrl: './org-structure.component.scss',
})
export class OrgStructureComponent implements OnInit {
  private departmentService = inject(DepartmentService);
  private orgRoleService = inject(OrgRoleService);
  private employeeService = inject(EmployeeService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  activeTab = signal<Tab>('departments');

  /** Active employees, for the (edit-mode) department-manager picker. */
  private employees = signal<EmployeeResponse[]>([]);
  /** Only hierarchy-holders (senior staff) can manage a department — most senior first. */
  readonly managerOptions = computed<SelectOption[]>(() => [
    { label: 'No manager', value: '' },
    ...this.employees()
      .filter(e => e.isActive && e.orgRoleId != null)
      .sort((a, b) => (a.orgRoleHierarchyLevel ?? Infinity) - (b.orgRoleHierarchyLevel ?? Infinity))
      .map(e => ({ label: `${e.fullName} — ${e.orgRoleName || e.role}`, value: e.employeeId })),
  ]);

  // ── Departments ──────────────────────────────────────────────
  departments = signal<Department[]>([]);
  departmentsLoading = signal(true);
  departmentsError = signal<string | null>(null);
  showAddDepartment = signal(false);
  editingDeptId = signal<string | null>(null);
  newDepartmentName = signal('');
  newDepartmentColor = signal('#6366f1');
  newDepartmentManagerId = signal('');
  savingDepartment = signal(false);
  deptPageSize = signal(10);
  deptCurrentPage = signal(1);

  readonly deptTotalPages = computed(() => Math.max(1, Math.ceil(this.departments().length / this.deptPageSize())));
  readonly deptPaged = computed(() => {
    const start = (this.deptCurrentPage() - 1) * this.deptPageSize();
    return this.departments().slice(start, start + this.deptPageSize());
  });
  readonly pageSizeOptions: SelectOption[] = [10, 25, 50].map(n => ({ label: `${n} / page`, value: n }));

  // ── Org roles ────────────────────────────────────────────────
  orgRoles = signal<OrgRole[]>([]);
  orgRolesLoading = signal(true);
  orgRolesError = signal<string | null>(null);
  showAddRole = signal(false);
  editingRoleId = signal<string | null>(null);
  newRoleName = signal('');
  newRoleHierarchyLevel = signal(1);
  newRoleDepartmentId = signal('');
  savingRole = signal(false);
  rolePageSize = signal(10);
  roleCurrentPage = signal(1);

  readonly roleTotalPages = computed(() => Math.max(1, Math.ceil(this.orgRoles().length / this.rolePageSize())));
  readonly rolePaged = computed(() => {
    const start = (this.roleCurrentPage() - 1) * this.rolePageSize();
    return this.orgRoles().slice(start, start + this.rolePageSize());
  });

  /** Departments to map a role to. */
  readonly departmentRoleOptions = computed<SelectOption[]>(() => [
    { label: 'No department', value: '' },
    ...this.departments().map(d => ({ label: d.name, value: d.departmentId })),
  ]);

  readonly departmentColumns: GridColumn<Department>[] = [
    {
      key: 'name', label: 'Department', type: 'text',
      value: (row) => row.name,
    },
    {
      key: 'managerFullName', label: 'Manager', type: 'text',
      value: (row) => row.managerFullName || '—',
    },
    {
      key: 'memberCount', label: 'Members', type: 'text',
      value: (row) => String(row.memberCount),
    },
    {
      key: 'actions', label: '', type: 'custom', width: '120px',
    },
  ];

  readonly roleColumns: GridColumn<OrgRole>[] = [
    { key: 'name', label: 'Role', type: 'text' },
    {
      key: 'departmentName', label: 'Department', type: 'text',
      value: (row) => row.departmentName || '—',
    },
    {
      key: 'hierarchyLevel', label: 'Hierarchy Level', type: 'text',
      value: (row) => String(row.hierarchyLevel),
    },
    {
      key: 'memberCount', label: 'Members', type: 'text',
      value: (row) => String(row.memberCount),
    },
    { key: 'actions', label: '', type: 'custom', width: '120px' },
  ];

  readonly departmentTrackBy = (row: Department) => row.departmentId;
  readonly roleTrackBy = (row: OrgRole) => row.id;

  ngOnInit(): void {
    this.loadDepartments();
    this.loadOrgRoles();
    this.employeeService.getAll().subscribe({
      next: (res) => this.employees.set(res.data ?? []),
      error: () => { /* manager picker (edit mode) just stays empty */ },
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  setDeptPageSize(n: number): void {
    this.deptPageSize.set(n);
    this.deptCurrentPage.set(1);
  }

  setDeptPage(p: number): void {
    if (p >= 1 && p <= this.deptTotalPages()) this.deptCurrentPage.set(p);
  }

  setRolePageSize(n: number): void {
    this.rolePageSize.set(n);
    this.roleCurrentPage.set(1);
  }

  setRolePage(p: number): void {
    if (p >= 1 && p <= this.roleTotalPages()) this.roleCurrentPage.set(p);
  }

  // ── Departments ──────────────────────────────────────────────

  /** `silent` keeps the current table on screen during a post-save refresh (no loading flicker/jump). */
  loadDepartments(silent = false): void {
    if (!silent) this.departmentsLoading.set(true);
    this.departmentsError.set(null);
    this.departmentService.getAll().subscribe({
      next: (res) => {
        this.departments.set(res.data ?? []);
        this.departmentsLoading.set(false);
      },
      error: (err) => {
        if (!silent) this.departmentsError.set('Failed to load departments. Please try again.');
        this.departmentsLoading.set(false);
        this.toast.error('Could not load departments', extractApiErrorMessage(err, ''));
      },
    });
  }

  openAddDepartment(): void {
    this.editingDeptId.set(null);
    this.newDepartmentName.set('');
    this.newDepartmentColor.set('#6366f1');
    this.newDepartmentManagerId.set('');
    this.showAddDepartment.set(true);
  }

  editDepartment(dept: Department): void {
    this.editingDeptId.set(dept.departmentId);
    this.newDepartmentName.set(dept.name);
    this.newDepartmentColor.set(dept.color || '#6366f1');
    this.newDepartmentManagerId.set(dept.managerId || '');
    this.showAddDepartment.set(true);
  }

  cancelAddDepartment(): void {
    this.showAddDepartment.set(false);
  }

  submitAddDepartment(): void {
    const name = this.newDepartmentName().trim();
    if (!name || this.savingDepartment()) return;
    this.savingDepartment.set(true);

    const editId = this.editingDeptId();
    const done = (verb: string) => {
      this.savingDepartment.set(false);
      this.showAddDepartment.set(false);
      this.toast.success(`Department ${verb}`, `"${name}" was ${verb} successfully.`);
      this.loadDepartments(true);
    };
    const fail = (verb: string) => (err: unknown) => {
      this.savingDepartment.set(false);
      this.toast.error(`Could not ${verb} department`, extractApiErrorMessage(err));
    };

    if (editId) {
      this.departmentService.update(editId, {
        name,
        color: this.newDepartmentColor() || null,
        managerId: this.newDepartmentManagerId() || null,
      }).subscribe({ next: () => done('updated'), error: fail('update') });
    } else {
      this.departmentService.create({
        name,
        color: this.newDepartmentColor() || undefined,
      }).subscribe({ next: () => done('created'), error: fail('create') });
    }
  }

  // ── Org roles ────────────────────────────────────────────────

  loadOrgRoles(silent = false): void {
    if (!silent) this.orgRolesLoading.set(true);
    this.orgRolesError.set(null);
    this.orgRoleService.getAll().subscribe({
      next: (res) => {
        this.orgRoles.set(res.data ?? []);
        this.orgRolesLoading.set(false);
      },
      error: (err) => {
        if (!silent) this.orgRolesError.set('Failed to load custom roles. Please try again.');
        this.orgRolesLoading.set(false);
        this.toast.error('Could not load custom roles', extractApiErrorMessage(err, ''));
      },
    });
  }

  openAddRole(): void {
    this.editingRoleId.set(null);
    this.newRoleName.set('');
    this.newRoleHierarchyLevel.set(1);
    this.newRoleDepartmentId.set('');
    this.showAddRole.set(true);
  }

  editRole(role: OrgRole): void {
    this.editingRoleId.set(role.id);
    this.newRoleName.set(role.name);
    this.newRoleHierarchyLevel.set(role.hierarchyLevel);
    this.newRoleDepartmentId.set(role.departmentId || '');
    this.showAddRole.set(true);
  }

  /** Hierarchy level is a positive rank (1 = most senior) — never negative/zero. */
  setRoleLevel(value: string | number): void {
    const n = Math.floor(Number(value));
    this.newRoleHierarchyLevel.set(Number.isFinite(n) && n >= 1 ? n : 1);
  }

  cancelAddRole(): void {
    this.showAddRole.set(false);
  }

  submitAddRole(): void {
    const name = this.newRoleName().trim();
    if (!name || this.savingRole()) return;
    this.savingRole.set(true);

    const payload = {
      name,
      hierarchyLevel: this.newRoleHierarchyLevel(),
      departmentId: this.newRoleDepartmentId() || null,
    };
    const editId = this.editingRoleId();
    const done = (verb: string) => {
      this.savingRole.set(false);
      this.showAddRole.set(false);
      this.toast.success(`Role ${verb}`, `"${name}" was ${verb} successfully.`);
      this.loadOrgRoles(true);
    };
    const fail = (verb: string) => (err: unknown) => {
      this.savingRole.set(false);
      this.toast.error(`Could not ${verb} role`, extractApiErrorMessage(err));
    };

    if (editId) {
      this.orgRoleService.update(editId, payload).subscribe({ next: () => done('updated'), error: fail('update') });
    } else {
      this.orgRoleService.create(payload).subscribe({ next: () => done('created'), error: fail('create') });
    }
  }

  async deleteOrgRole(role: OrgRole): Promise<void> {
    if (role.isSystemDefault) return;
    const ok = await this.modal.confirm({
      title: 'Delete role',
      message: `Delete role "${role.name}"? This cannot be undone.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;

    this.orgRoleService.delete(role.id).subscribe({
      next: () => {
        this.toast.success('Role deleted', `"${role.name}" was removed.`);
        this.loadOrgRoles(true);
      },
      // 409 now covers two distinct cases (EMPLOYEE_FEATURE_INTEGRATION.md §3.2):
      // a system-default role, or a role still assigned to one or more employees —
      // the server's own message distinguishes them, so just surface it verbatim
      // instead of assuming which one it is.
      error: (err) => {
        this.toast.error('Could not delete role', extractApiErrorMessage(err));
      },
    });
  }

  // ── Departments: delete ────────────────────────────────────────

  async deleteDepartment(department: Department): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Delete department',
      message: `Delete department "${department.name}"? Its employees will be reassigned to Hierarchy classification, not removed.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;

    this.departmentService.delete(department.departmentId).subscribe({
      next: () => {
        this.toast.success('Department deleted', `"${department.name}" was removed.`);
        this.loadDepartments(true);
      },
      error: (err) => {
        this.toast.error('Could not delete department', extractApiErrorMessage(err));
      },
    });
  }
}
