import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../../../core/services/department.service';
import { DesignationService } from '../../../../core/services/designation.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { Department } from '../../../../core/models/department.model';
import { Designation } from '../../../../core/models/designation.model';
import { OrgRole } from '../../../../core/models/org-role.model';

type Tab = 'departments' | 'designations' | 'roles';

@Component({
  selector: 'app-org-structure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './org-structure.component.html',
  styleUrl: './org-structure.component.scss',
})
export class OrgStructureComponent implements OnInit {
  private departmentService = inject(DepartmentService);
  private designationService = inject(DesignationService);
  private orgRoleService = inject(OrgRoleService);
  private toast = inject(ToastService);

  activeTab = signal<Tab>('departments');

  // ── Departments ──────────────────────────────────────────────
  departments = signal<Department[]>([]);
  departmentsLoading = signal(true);
  departmentsError = signal<string | null>(null);
  showAddDepartment = signal(false);
  newDepartmentName = signal('');
  newDepartmentColor = signal('#6366f1');
  newDepartmentManagerId = signal('');
  savingDepartment = signal(false);

  // ── Designations ─────────────────────────────────────────────
  designations = signal<Designation[]>([]);
  designationsLoading = signal(true);
  designationsError = signal<string | null>(null);
  showAddDesignation = signal(false);
  newDesignationTitle = signal('');
  savingDesignation = signal(false);

  // ── Org roles ────────────────────────────────────────────────
  orgRoles = signal<OrgRole[]>([]);
  orgRolesLoading = signal(true);
  orgRolesError = signal<string | null>(null);
  showAddRole = signal(false);
  newRoleName = signal('');
  newRoleHierarchyLevel = signal(1);
  savingRole = signal(false);

  ngOnInit(): void {
    this.loadDepartments();
    this.loadDesignations();
    this.loadOrgRoles();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  // ── Departments ──────────────────────────────────────────────

  loadDepartments(): void {
    this.departmentsLoading.set(true);
    this.departmentsError.set(null);
    this.departmentService.getAll().subscribe({
      next: (res) => {
        this.departments.set(res.data ?? []);
        this.departmentsLoading.set(false);
      },
      error: (err) => {
        this.departmentsError.set('Failed to load departments. Please try again.');
        this.departmentsLoading.set(false);
        this.toast.error('Could not load departments', err?.error?.message ?? '');
      },
    });
  }

  openAddDepartment(): void {
    this.newDepartmentName.set('');
    this.newDepartmentColor.set('#6366f1');
    this.newDepartmentManagerId.set('');
    this.showAddDepartment.set(true);
  }

  cancelAddDepartment(): void {
    this.showAddDepartment.set(false);
  }

  submitAddDepartment(): void {
    const name = this.newDepartmentName().trim();
    if (!name || this.savingDepartment()) return;

    this.savingDepartment.set(true);
    this.departmentService.create({
      name,
      color: this.newDepartmentColor() || undefined,
      managerId: this.newDepartmentManagerId().trim() || undefined,
    }).subscribe({
      next: () => {
        this.savingDepartment.set(false);
        this.showAddDepartment.set(false);
        this.toast.success('Department created', `"${name}" was added successfully.`);
        this.loadDepartments();
      },
      error: (err) => {
        this.savingDepartment.set(false);
        this.toast.error('Could not create department', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Designations ─────────────────────────────────────────────

  loadDesignations(): void {
    this.designationsLoading.set(true);
    this.designationsError.set(null);
    this.designationService.getAll().subscribe({
      next: (res) => {
        this.designations.set(res.data ?? []);
        this.designationsLoading.set(false);
      },
      error: (err) => {
        this.designationsError.set('Failed to load designations. Please try again.');
        this.designationsLoading.set(false);
        this.toast.error('Could not load designations', err?.error?.message ?? '');
      },
    });
  }

  openAddDesignation(): void {
    this.newDesignationTitle.set('');
    this.showAddDesignation.set(true);
  }

  cancelAddDesignation(): void {
    this.showAddDesignation.set(false);
  }

  submitAddDesignation(): void {
    const title = this.newDesignationTitle().trim();
    if (!title || this.savingDesignation()) return;

    this.savingDesignation.set(true);
    this.designationService.create({ title }).subscribe({
      next: () => {
        this.savingDesignation.set(false);
        this.showAddDesignation.set(false);
        this.toast.success('Designation created', `"${title}" was added successfully.`);
        this.loadDesignations();
      },
      error: (err) => {
        this.savingDesignation.set(false);
        this.toast.error('Could not create designation', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  deleteDesignation(designation: Designation): void {
    if (!confirm(`Delete designation "${designation.title}"? This cannot be undone.`)) return;

    this.designationService.delete(designation.designationId).subscribe({
      next: () => {
        this.toast.success('Designation deleted', `"${designation.title}" was removed.`);
        this.loadDesignations();
      },
      error: (err) => {
        this.toast.error('Could not delete designation', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Org roles ────────────────────────────────────────────────

  loadOrgRoles(): void {
    this.orgRolesLoading.set(true);
    this.orgRolesError.set(null);
    this.orgRoleService.getAll().subscribe({
      next: (res) => {
        this.orgRoles.set(res.data ?? []);
        this.orgRolesLoading.set(false);
      },
      error: (err) => {
        this.orgRolesError.set('Failed to load custom roles. Please try again.');
        this.orgRolesLoading.set(false);
        this.toast.error('Could not load custom roles', err?.error?.message ?? '');
      },
    });
  }

  openAddRole(): void {
    this.newRoleName.set('');
    this.newRoleHierarchyLevel.set(1);
    this.showAddRole.set(true);
  }

  cancelAddRole(): void {
    this.showAddRole.set(false);
  }

  submitAddRole(): void {
    const name = this.newRoleName().trim();
    if (!name || this.savingRole()) return;

    this.savingRole.set(true);
    this.orgRoleService.create({
      name,
      hierarchyLevel: this.newRoleHierarchyLevel(),
    }).subscribe({
      next: () => {
        this.savingRole.set(false);
        this.showAddRole.set(false);
        this.toast.success('Role created', `"${name}" was added successfully.`);
        this.loadOrgRoles();
      },
      error: (err) => {
        this.savingRole.set(false);
        this.toast.error('Could not create role', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  deleteOrgRole(role: OrgRole): void {
    if (role.isSystemDefault) return;
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;

    this.orgRoleService.delete(role.id).subscribe({
      next: () => {
        this.toast.success('Role deleted', `"${role.name}" was removed.`);
        this.loadOrgRoles();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.toast.error('Cannot delete system role', `"${role.name}" is a built-in role and can't be removed.`);
        } else {
          this.toast.error('Could not delete role', err?.error?.message ?? 'Please try again.');
        }
      },
    });
  }
}
