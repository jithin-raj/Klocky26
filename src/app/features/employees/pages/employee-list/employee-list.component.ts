import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeRow, EmployeeRole, EmployeeStatus } from '../../models/employee.model';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { EmployeeResponse, BulkImportResponse } from '../../models/employee-api.model';
import {
  UiDataGridComponent, GridColumnTemplateDirective, GridColumn, GridAction, SortDirection,
  HasPermissionDirective, UiSelectComponent, UiLoaderComponent, SelectOption, UiPaginationComponent,
} from '../../../../shared/components';

type SortField = 'fullName' | 'employeeCode' | 'department' | 'role' | 'dateOfJoining' | 'status';
type SortDir   = 'asc' | 'desc';

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9',
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Mirrors the original .el-role-badge / .el-status-badge color palette. */
const ROLE_BADGE_COLORS: Record<EmployeeRole, { bg: string; fg: string }> = {
  admin:    { bg: '#ede9fe', fg: '#7c3aed' },
  hr:       { bg: '#fce7f3', fg: '#db2777' },
  manager:  { bg: '#dbeafe', fg: '#2563eb' },
  employee: { bg: '#f1f5f9', fg: '#475569' },
};

const STATUS_BADGE_COLORS: Record<EmployeeStatus, { bg: string; fg: string }> = {
  active:   { bg: '#dcfce7', fg: '#16a34a' },
  inactive: { bg: '#fee2e2', fg: '#dc2626' },
  on_leave: { bg: '#fef9c3', fg: '#b45309' },
};

/** Maps the API EmployeeResponse shape onto the existing EmployeeRow shape the templates already render. */
function toRow(e: EmployeeResponse): EmployeeRow {
  return {
    id: e.employeeId,
    employeeCode: e.employeeCode ?? '',
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone ?? '',
    role: (e.role === 'super_admin' ? 'admin' : e.role) as EmployeeRole,
    orgRoleName: e.orgRoleName,
    employmentType: e.employmentType,
    department: e.departmentName ?? '',
    designation: e.designationTitle ?? '',
    reportingManagerId: e.reportingManagerId,
    reportingManagerName: e.reportingManagerName,
    officeLocation: e.overrideOfficeName ?? '',
    dateOfJoining: e.dateOfJoining ?? '',
    avatarUrl: e.avatarUrl,
    initials: initialsOf(e.fullName),
    avatarColor: colorFor(e.employeeId),
    isActive: e.isActive,
    status: (e.isActive ? 'active' : 'inactive') as EmployeeStatus,
    isGuest: e.isGuest ?? false,
    basicSalary: e.basicSalary,
    allowances: e.allowances,
    otherDeductions: e.otherDeductions,
  };
}

@Component({
  selector: 'app-employee-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, UiDataGridComponent, GridColumnTemplateDirective,
    HasPermissionDirective, UiSelectComponent, UiLoaderComponent, UiPaginationComponent,
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent implements OnInit {
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);
  private permissions = inject(PermissionService);

  /** Payroll columns/actions only for admin/HR (spec §3, §8). */
  readonly canSeePayroll = computed(() => this.permissions.isAdmin() || this.permissions.isHr());

  private allEmployees: EmployeeRow[] = [];

  loading       = signal(true);
  loadError     = signal<string | null>(null);

  search        = signal('');
  filterDept    = signal('');
  filterRole    = signal('');
  filterStatus  = signal('');
  sortField     = signal<SortField>('fullName');
  sortDir       = signal<SortDir>('asc');
  pageSize      = signal(10);
  currentPage   = signal(1);
  selectedIds   = signal<Set<string>>(new Set());

  // Bulk import state
  bulkImportOpen   = signal(false);
  bulkImporting    = signal(false);
  bulkImportResult = signal<BulkImportResponse | null>(null);
  bulkImportError  = signal<string | null>(null);

  rows = signal<EmployeeRow[]>([]);
  departments = signal<string[]>([]);

  readonly statuses    = ['active','inactive'];
  readonly pageSizes   = [10, 25, 50];

  // Styled filter dropdowns (ui-select) — replace native <select>.
  readonly deptFilterOptions = computed<SelectOption[]>(() => [
    { label: 'All Departments', value: '' },
    ...this.departments().map(d => ({ label: d, value: d })),
  ]);
  readonly roleFilterOptions = computed<SelectOption[]>(() => {
    const values = new Set<string>();
    this.rows().forEach((row) => {
      if (row.role) values.add(row.role);
      if (row.orgRoleName) values.add(row.orgRoleName);
    });
    return [
      { label: 'All Roles', value: '' },
      ...Array.from(values)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map((role) => ({ label: this.roleLabel(role), value: role })),
    ];
  });
  readonly statusFilterOptions: SelectOption[] = [
    { label: 'All Status', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];
  readonly pageSizeOptions: SelectOption[] = [10, 25, 50].map(n => ({ label: `${n} / page`, value: n }));

  /** Columns are permission-aware: payroll shows only for admin/HR (spec §3). */
  readonly columns = computed<GridColumn<EmployeeRow>[]>(() => {
    const cols: GridColumn<EmployeeRow>[] = [
      {
        key: 'fullName', label: 'Employee', sortable: true, type: 'avatar',
        avatarInitials: (r) => r.initials,
        avatarColor: (r) => r.avatarColor,
        primaryText: (r) => r.fullName,
        secondaryText: (r) => r.email,
        tertiaryText: (r) => r.employeeCode,
      },
      {
        key: 'department', label: 'Department', sortable: true, type: 'text-pair',
        primaryText: (r) => r.department,
        secondaryText: (r) => r.designation,
      },
      {
        // Show the org/hierarchy role name (CEO, Manager…) — falls back to the
        // system role label when an employee has no org role assigned.
        key: 'role', label: 'Role', sortable: true, type: 'badge',
        value: (r) => r.orgRoleName || this.roleLabel(r.role),
        badgeBg: (_v, r) => r.orgRoleName ? '#eef2ff' : (ROLE_BADGE_COLORS[r.role]?.bg ?? '#f1f5f9'),
        badgeColor: (_v, r) => r.orgRoleName ? '#4338ca' : (ROLE_BADGE_COLORS[r.role]?.fg ?? '#475569'),
      },
      {
        key: 'employmentType', label: 'Employment', type: 'text',
        value: (r) => this.empTypeLabel(r.employmentType),
      },
    ];

    if (this.canSeePayroll()) {
      // Masked by default — reveal per row via the eye toggle in the custom cell.
      cols.push({ key: 'basicSalary', label: 'Basic Salary', type: 'custom', width: '150px' });
    }

    cols.push({
      key: 'status', label: 'Status', sortable: true, type: 'badge',
      value: (r) => r.status,
      badgeClass: (v) => v,
      badgeLabel: (v) => this.statusLabel(v),
      badgeBg: (v) => STATUS_BADGE_COLORS[v as EmployeeStatus]?.bg ?? '#f1f5f9',
      badgeColor: (v) => STATUS_BADGE_COLORS[v as EmployeeStatus]?.fg ?? '#475569',
    });
    return cols;
  });

  // ── Basic-salary masking (reveal per row) ──────────────────────────
  private readonly revealedSalary = signal<Set<string>>(new Set());
  isSalaryRevealed(id: string) { return this.revealedSalary().has(id); }
  toggleSalary(id: string, ev: Event) {
    ev.stopPropagation();
    const next = new Set(this.revealedSalary());
    next.has(id) ? next.delete(id) : next.add(id);
    this.revealedSalary.set(next);
  }

  empTypeLabel(t?: string | null): string {
    if (!t) return '—';
    return ({ full_time: 'Full-time', part_time: 'Part-time', permanent: 'Permanent', contract: 'Contract', intern: 'Intern' } as Record<string, string>)[t]
      ?? (t.charAt(0).toUpperCase() + t.slice(1));
  }

  /**
   * Grid keeps only navigation actions — password reset, (de)activate and
   * delete/permanent-delete now live on the employee profile/detail view.
   */
  readonly rowActions: GridAction<EmployeeRow>[] = [
    { label: 'View Profile', click: (r) => this.viewEmployee(r.id) },
    { label: 'Edit', visible: () => this.permissions.can('employees', 2), click: (r) => this.editEmployee(r.id) },
  ];

  readonly filtered = computed(() => {
    const q    = this.search().toLowerCase().trim();
    const dept = this.filterDept();
    const role = this.filterRole();
    const stat = this.filterStatus();

    let rows = this.rows().filter(e => {
      if (q && !e.fullName.toLowerCase().includes(q)
            && !e.email.toLowerCase().includes(q)
            && !e.employeeCode.toLowerCase().includes(q)
            && !e.department.toLowerCase().includes(q)
            && !e.designation.toLowerCase().includes(q)) return false;
      if (dept && e.department !== dept) return false;
      if (role && e.role !== role && e.orgRoleName !== role) return false;
      if (stat && e.status !== stat)     return false;
      return true;
    });

    const f = this.sortField();
    const d = this.sortDir();
    rows = [...rows].sort((a, b) => {
      const av = (a[f] ?? '') as string;
      const bv = (b[f] ?? '') as string;
      return d === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  });

  readonly totalPages  = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));
  readonly paged       = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });
  readonly startResult = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  readonly endResult   = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filtered().length));

  ngOnInit() {
    this.loadEmployees();
    this.departmentService.getAll().subscribe({
      next: (res) => this.departments.set((res.data ?? []).map(d => d.name)),
      error: () => { /* filter dropdown just stays empty on failure */ },
    });
  }

  private loadEmployees() {
    this.loading.set(true);
    this.loadError.set(null);
    this.employeeService.getAll().subscribe({
      next: (res) => {
        this.allEmployees = (res.data ?? []).map(toRow);
        this.rows.set(this.allEmployees);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load employees. Please try again.');
        this.loading.set(false);
      },
    });
  }

  setSearch(v: string)   { this.search.set(v);        this.currentPage.set(1); }
  setDept(v: string)     { this.filterDept.set(v);    this.currentPage.set(1); }
  setRole(v: string)     { this.filterRole.set(v);    this.currentPage.set(1); }
  setStatus(v: string)   { this.filterStatus.set(v);  this.currentPage.set(1); }
  setPageSize(n: number) { this.pageSize.set(n);       this.currentPage.set(1); }
  setPage(p: number)     { if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p); }

  clearFilters() {
    this.search.set(''); this.filterDept.set('');
    this.filterRole.set(''); this.filterStatus.set('');
    this.currentPage.set(1);
  }

  /** ui-data-grid is presentational about sorting — it just emits which column was clicked. */
  onGridSortChange(e: { key: string; direction: SortDirection }) {
    this.sortField.set(e.key as SortField);
    this.sortDir.set(e.direction);
  }

  onGridSelectionChange(ids: Set<string | number>) {
    this.selectedIds.set(ids as Set<string>);
  }

  onGridRowClick(_emp: EmployeeRow) {
    // Row click is intentionally a no-op for now; actions/checkbox handle interaction.
  }

  trackById = (row: EmployeeRow) => row.id;

  viewEmployee(id: string)   { this.orgNav.navigate(['app', 'employees', id]); }
  editEmployee(id: string)   { this.orgNav.navigate(['app', 'employees', id, 'edit']); }
  addEmployee()              { this.orgNav.navigate(['app', 'employees', 'add']); }
  viewOrgTree()              { this.orgNav.navigate(['app', 'employees', 'tree']); }

  statusLabel(s: string) { return s === 'on_leave' ? 'On Leave' : (s.charAt(0).toUpperCase() + s.slice(1)); }
  roleLabel(r: string)   { return r.charAt(0).toUpperCase() + r.slice(1); }

  get activeFilters(): boolean {
    return !!(this.search() || this.filterDept() || this.filterRole() || this.filterStatus());
  }

  get selectedCount(): number { return this.selectedIds().size; }

  // ── Bulk import ────────────────────────────────────────────────────────

  openBulkImport() {
    this.bulkImportResult.set(null);
    this.bulkImportError.set(null);
    this.bulkImportOpen.set(true);
  }

  closeBulkImport() {
    this.bulkImportOpen.set(false);
    this.bulkImportResult.set(null);
    this.bulkImportError.set(null);
  }

  onBulkFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.bulkImporting.set(true);
    this.bulkImportError.set(null);
    this.bulkImportResult.set(null);
    this.employeeService.bulkImport(file).subscribe({
      next: (res) => {
        this.bulkImportResult.set(res.data);
        this.bulkImporting.set(false);
        this.loadEmployees();
      },
      error: () => {
        this.bulkImportError.set('Bulk import failed. Please check the file and try again.');
        this.bulkImporting.set(false);
      },
    });
  }

  downloadTemplate() {
    this.employeeService.downloadBulkImportTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee-bulk-import-template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    });
  }
}
