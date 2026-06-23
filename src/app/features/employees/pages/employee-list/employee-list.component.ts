import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeRow, EmployeeRole, EmployeeStatus } from '../../models/employee.model';
import { RolePermissionModalComponent } from '../../components/role-permission-modal/role-permission-modal.component';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { EmployeeResponse, BulkImportResponse } from '../../models/employee-api.model';

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
  };
}

@Component({
  selector: 'app-employee-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RolePermissionModalComponent],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent implements OnInit {
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private departmentService = inject(DepartmentService);

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
  actionMenuId  = signal<string | null>(null);
  deactivateTarget = signal<EmployeeRow | null>(null);

  // Role modal state
  roleModalOpen = signal(false);
  selectedEmployee = signal<EmployeeRow | null>(null);

  // Bulk import state
  bulkImportOpen   = signal(false);
  bulkImporting    = signal(false);
  bulkImportResult = signal<BulkImportResponse | null>(null);
  bulkImportError  = signal<string | null>(null);

  rows = signal<EmployeeRow[]>([]);
  departments = signal<string[]>([]);

  readonly roles       = ['admin','hr','manager','employee'];
  readonly statuses    = ['active','inactive'];
  readonly pageSizes   = [10, 25, 50];

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
      if (role && e.role !== role)       return false;
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
  readonly allSelected = computed(() =>
    this.paged().length > 0 && this.paged().every(r => this.selectedIds().has(r.id))
  );
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

  @HostListener('document:click')
  closeMenus() { this.actionMenuId.set(null); }

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

  sort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field); this.sortDir.set('asc');
    }
  }

  sortIcon(f: SortField) {
    if (this.sortField() !== f) return 'both';
    return this.sortDir() === 'asc' ? 'asc' : 'desc';
  }

  toggleSelect(id: string) {
    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }

  toggleSelectAll() {
    const s = new Set(this.selectedIds());
    if (this.allSelected()) { this.paged().forEach(r => s.delete(r.id)); }
    else                    { this.paged().forEach(r => s.add(r.id));    }
    this.selectedIds.set(s);
  }

  openActionMenu(id: string, event: Event) {
    event.stopPropagation();
    this.actionMenuId.set(this.actionMenuId() === id ? null : id);
  }

  viewEmployee(id: string)   { this.orgNav.navigate(['app', 'employees', id]); }
  editEmployee(id: string)   { this.orgNav.navigate(['app', 'employees', id, 'edit']); }
  addEmployee()              { this.orgNav.navigate(['app', 'employees', 'add']); }
  viewOrgTree()              { this.orgNav.navigate(['app', 'employees', 'tree']); }

  confirmDeactivate(emp: EmployeeRow) {
    this.deactivateTarget.set(emp);
    this.actionMenuId.set(null);
  }

  doDeactivate() {
    const t = this.deactivateTarget();
    if (!t) return;
    this.employeeService.deactivate(t.id).subscribe({
      next: () => {
        const idx = this.allEmployees.findIndex(e => e.id === t.id);
        if (idx !== -1) this.allEmployees[idx] = { ...this.allEmployees[idx], isActive: false, status: 'inactive' };
        this.rows.set([...this.allEmployees]);
        this.deactivateTarget.set(null);
      },
      error: () => { this.deactivateTarget.set(null); },
    });
  }

  cancelDeactivate() { this.deactivateTarget.set(null); }

  activateEmployee(emp: EmployeeRow) {
    this.actionMenuId.set(null);
    this.employeeService.activate(emp.id).subscribe({
      next: () => {
        const idx = this.allEmployees.findIndex(e => e.id === emp.id);
        if (idx !== -1) this.allEmployees[idx] = { ...this.allEmployees[idx], isActive: true, status: 'active' };
        this.rows.set([...this.allEmployees]);
      },
    });
  }

  manageRole(emp: EmployeeRow) {
    this.selectedEmployee.set(emp);
    this.roleModalOpen.set(true);
    this.actionMenuId.set(null);
  }

  closeRoleModal() {
    this.roleModalOpen.set(false);
    this.selectedEmployee.set(null);
  }

  onRoleChange(data: { role: string; permissions: string[] }) {
    const emp = this.selectedEmployee();
    if (!emp) return;

    console.log('Role updated for', emp.fullName, ':', data);
    // Update employee role in the list (local state only — role.manage org-roles
    // assignment is a separate, lower-priority API not wired here, see report)
    const idx = this.allEmployees.findIndex(e => e.id === emp.id);
    if (idx !== -1) {
      this.allEmployees[idx] = {
        ...this.allEmployees[idx],
        role: data.role as any
      };
      this.rows.set([...this.allEmployees]);
    }
    this.closeRoleModal();
  }

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
