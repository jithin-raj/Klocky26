import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, SelectOption, UiSaveBarComponent } from '../../../../shared/components';
import { PermissionService } from '../../../../core/services/permission.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  AccessLevel,
  PermissionFeature,
  PermissionEntry,
  ENFORCED_PERMISSION_MODULES,
} from '../../../../core/models/permission.model';
import { OrgRole } from '../../../../core/models/org-role.model';
import { Department } from '../../../../core/models/department.model';
import { EmployeeResponse } from '../../models/employee-api.model';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';

type Axis = 'role' | 'department' | 'employee';

interface ModuleGroup {
  module: string;
  enforced: boolean;
  features: PermissionFeature[];
}

interface AccessChoice { label: string; value: AccessLevel; }

const ACCESS_LEVEL_CHOICES: AccessChoice[] = [
  { label: 'No access', value: 0 },
  { label: 'View', value: 1 },
  { label: 'Add & Edit', value: 2 },
  { label: 'Full', value: 3 },
];

@Component({
  selector: 'app-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiSaveBarComponent],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent implements OnInit {
  private permissionService = inject(PermissionService);
  private orgRoleService = inject(OrgRoleService);
  private departmentService = inject(DepartmentService);
  private employeeService = inject(EmployeeService);
  private toast = inject(ToastService);

  readonly accessLevelChoices = ACCESS_LEVEL_CHOICES;

  /** Whether the current user may view/edit payroll.* rows (spec §2, §8). */
  readonly canSeePayroll = computed(() => this.permissionService.isAdmin() || this.permissionService.isHr());

  // ── Catalog ──────────────────────────────────────────────────
  catalogLoading = signal(true);
  catalogError = signal<string | null>(null);
  catalog = signal<PermissionFeature[]>([]);

  moduleGroups = computed<ModuleGroup[]>(() => {
    const showPayroll = this.canSeePayroll();
    const byModule = new Map<string, PermissionFeature[]>();
    for (const feature of this.catalog()) {
      // Hide payroll.* rows unless the current user is admin/HR (spec §2).
      if (!showPayroll && feature.key.startsWith('payroll.')) continue;
      const list = byModule.get(feature.module) ?? [];
      list.push(feature);
      byModule.set(feature.module, list);
    }
    return Array.from(byModule.entries()).map(([module, features]) => ({
      module,
      enforced: (ENFORCED_PERMISSION_MODULES as readonly string[]).includes(module),
      features,
    }));
  });

  // ── Axis + subject selection ────────────────────────────────
  axis = signal<Axis>('role');

  orgRoles = signal<OrgRole[]>([]);
  orgRolesLoading = signal(true);
  departments = signal<Department[]>([]);
  departmentsLoading = signal(true);
  employees = signal<EmployeeResponse[]>([]);
  employeesLoading = signal(true);

  roleOptions = computed<SelectOption[]>(() =>
    this.orgRoles().map(r => ({ label: r.name, value: r.id }))
  );
  departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map(d => ({ label: d.name, value: d.departmentId }))
  );
  employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map(e => ({ label: `${e.fullName} — ${e.email}`, value: e.employeeId }))
  );

  selectedSubjectId = signal<string>('');

  /**
   * The Admin role is rendered read-only — it always has full access and can't
   * be restricted (spec §11). Detect it by the system-default flag or name.
   */
  readonly isSubjectReadOnly = computed(() => {
    if (this.axis() !== 'role') return false;
    const role = this.orgRoles().find(r => r.id === this.selectedSubjectId());
    if (!role) return false;
    const name = role.name.toLowerCase();
    return name === 'admin' || name === 'super admin' || name === 'super_admin'
      || (role.isSystemDefault && name.includes('admin'));
  });

  // ── Subject permission data ─────────────────────────────────
  subjectLoading = signal(false);
  subjectError = signal<string | null>(null);
  /** True when the per-subject endpoint isn't available (404) — grid falls back to catalog defaults. */
  subjectUnavailable = signal(false);
  subjectName = signal<string>('');
  /** featureKey -> accessLevel, current in-memory state of every row's selector */
  accessLevels = signal<Map<string, 0 | 1 | 2 | 3>>(new Map());
  /** featureKey -> isOverridden, refreshed after load/save */
  overridden = signal<Map<string, boolean>>(new Map());
  /** featureKey -> highest level the editor may pick (department ceiling). Default 3. */
  maxSelectable = signal<Map<string, AccessLevel>>(new Map());
  /** featureKey -> capped-by-department flag (for the lock badge). */
  cappedByDept = signal<Map<string, boolean>>(new Map());

  saving = signal(false);

  // ── Dirty tracking (floating save bar) ─────────────────────────
  private readonly pristineLevels = signal('');
  /** True when the matrix differs from the loaded/saved snapshot. */
  readonly isDirty = computed(() =>
    !!this.pristineLevels() && JSON.stringify([...this.accessLevels()]) !== this.pristineLevels());
  private snapshotLevels() { this.pristineLevels.set(JSON.stringify([...this.accessLevels()])); }
  discardChanges() {
    if (!this.pristineLevels()) return;
    this.accessLevels.set(new Map(JSON.parse(this.pristineLevels())));
  }

  /** Highest level selectable for a row (department ceiling). */
  maxSelectableFor(featureKey: string): AccessLevel {
    return this.maxSelectable().get(featureKey) ?? 3;
  }
  isCapped(featureKey: string): boolean {
    return this.cappedByDept().get(featureKey) ?? false;
  }

  ngOnInit(): void {
    this.loadCatalog();
    this.loadOrgRoles();
    this.loadDepartments();
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.employeesLoading.set(true);
    this.employeeService.getAll().subscribe({
      next: (res) => { this.employees.set(res.data ?? []); this.employeesLoading.set(false); },
      error: () => { this.employeesLoading.set(false); },
    });
  }

  // ── Catalog ──────────────────────────────────────────────────

  loadCatalog(): void {
    this.catalogLoading.set(true);
    this.catalogError.set(null);
    this.permissionService.getCatalog().subscribe({
      next: (res) => {
        this.catalog.set(res.data ?? []);
        this.catalogLoading.set(false);
      },
      error: (err) => {
        this.catalogError.set('Failed to load the permission catalog. Please try again.');
        this.catalogLoading.set(false);
        this.toast.error('Could not load permission catalog', extractApiErrorMessage(err, ''));
      },
    });
  }

  // ── Subject lists ────────────────────────────────────────────

  loadOrgRoles(): void {
    this.orgRolesLoading.set(true);
    this.orgRoleService.getAll().subscribe({
      next: (res) => {
        this.orgRoles.set(res.data ?? []);
        this.orgRolesLoading.set(false);
      },
      error: (err) => {
        this.orgRolesLoading.set(false);
        this.toast.error('Could not load roles', extractApiErrorMessage(err, ''));
      },
    });
  }

  loadDepartments(): void {
    this.departmentsLoading.set(true);
    this.departmentService.getAll().subscribe({
      next: (res) => {
        this.departments.set(res.data ?? []);
        this.departmentsLoading.set(false);
      },
      error: (err) => {
        this.departmentsLoading.set(false);
        this.toast.error('Could not load departments', extractApiErrorMessage(err, ''));
      },
    });
  }

  // ── Axis / subject switching ─────────────────────────────────

  setAxis(axis: Axis): void {
    if (this.axis() === axis) return;
    this.axis.set(axis);
    this.selectedSubjectId.set('');
    this.resetSubjectState();
  }

  onSubjectChange(id: string): void {
    this.selectedSubjectId.set(id);
    if (!id) {
      this.resetSubjectState();
      return;
    }
    this.loadSubject(id);
  }

  private resetSubjectState(): void {
    this.subjectError.set(null);
    this.subjectUnavailable.set(false);
    this.subjectName.set('');
    this.accessLevels.set(new Map());
    this.overridden.set(new Map());
    this.pristineLevels.set('');
  }

  loadSubject(id: string): void {
    this.subjectLoading.set(true);
    this.subjectError.set(null);
    this.subjectUnavailable.set(false);

    const request$ =
      this.axis() === 'role' ? this.permissionService.getForRole(id) :
      this.axis() === 'department' ? this.permissionService.getForDepartment(id) :
      this.permissionService.getForEmployee(id);

    request$.subscribe({
      next: (res) => {
        this.applySubjectResponse(res.data ?? null);
        this.subjectLoading.set(false);
      },
      error: (err) => {
        this.subjectLoading.set(false);
        if (err?.status === 404) {
          // Per-subject endpoint isn't deployed on this backend — show the
          // catalog defaults so the grid is still usable, with an honest notice.
          this.applySubjectResponse(null);
          this.subjectUnavailable.set(true);
          return;
        }
        this.subjectError.set('Failed to load permissions for this selection. Please try again.');
        this.toast.error('Could not load permissions', extractApiErrorMessage(err, ''));
      },
    });
  }

  private applySubjectResponse(data: { subjectName: string; entries: PermissionEntry[] } | null): void {
    const entryByKey = new Map<string, PermissionEntry>();
    for (const entry of data?.entries ?? []) {
      entryByKey.set(entry.featureKey, entry);
    }

    const levels = new Map<string, 0 | 1 | 2 | 3>();
    const overrides = new Map<string, boolean>();
    const maxSel = new Map<string, AccessLevel>();
    const capped = new Map<string, boolean>();

    for (const feature of this.catalog()) {
      const entry = entryByKey.get(feature.key);
      const max = (entry?.maxSelectable ?? entry?.departmentCap ?? 3) as AccessLevel;
      // Effective level can never exceed the department ceiling.
      const raw = entry ? entry.accessLevel : feature.defaultLevel;
      levels.set(feature.key, Math.min(raw, max) as AccessLevel);
      overrides.set(feature.key, entry ? entry.isOverridden : false);
      maxSel.set(feature.key, max);
      capped.set(feature.key, entry?.isCappedByDepartment ?? false);
    }

    this.subjectName.set(data?.subjectName ?? '');
    this.accessLevels.set(levels);
    this.overridden.set(overrides);
    this.maxSelectable.set(maxSel);
    this.cappedByDept.set(capped);
    this.snapshotLevels();
  }

  setAccessLevel(featureKey: string, level: 0 | 1 | 2 | 3): void {
    // Never let a level above the department ceiling be chosen.
    const capped = Math.min(level, this.maxSelectableFor(featureKey)) as 0 | 1 | 2 | 3;
    const next = new Map(this.accessLevels());
    next.set(featureKey, capped);
    this.accessLevels.set(next);
  }

  levelFor(featureKey: string): 0 | 1 | 2 | 3 {
    return this.accessLevels().get(featureKey) ?? 0;
  }

  isRowOverridden(featureKey: string): boolean {
    return this.overridden().get(featureKey) ?? false;
  }

  // ── Save ──────────────────────────────────────────────────────

  save(): void {
    const id = this.selectedSubjectId();
    if (!id || this.saving()) return;

    const levels = this.accessLevels();
    const entries = this.catalog().map(feature => ({
      featureKey: feature.key,
      accessLevel: levels.get(feature.key) ?? feature.defaultLevel,
    }));

    this.saving.set(true);

    const request$ =
      this.axis() === 'role' ? this.permissionService.updateForRole(id, { entries }) :
      this.axis() === 'department' ? this.permissionService.updateForDepartment(id, { entries }) :
      this.permissionService.updateForEmployee(id, { entries });

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.applySubjectResponse(res.data ?? null);
        this.toast.success('Permissions saved', 'The access levels were updated successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 404) {
          this.toast.error('Saving not available', 'This backend doesn’t expose the permission-matrix save endpoint yet.');
          return;
        }
        this.toast.error('Could not save permissions', extractApiErrorMessage(err));
      },
    });
  }
}
