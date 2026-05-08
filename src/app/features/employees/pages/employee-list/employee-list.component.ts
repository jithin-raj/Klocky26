import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MOCK_EMPLOYEES, EmployeeRow, DEPARTMENTS } from '../../models/employee.model';
import { RolePermissionModalComponent } from '../../components/role-permission-modal/role-permission-modal.component';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';

type SortField = 'fullName' | 'employeeCode' | 'department' | 'role' | 'dateOfJoining' | 'status';
type SortDir   = 'asc' | 'desc';

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

  private allEmployees = [...MOCK_EMPLOYEES];

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

  readonly departments = DEPARTMENTS;
  readonly roles       = ['admin','hr','manager','employee'];
  readonly statuses    = ['active','inactive','on_leave'];
  readonly pageSizes   = [10, 25, 50];

  readonly filtered = computed(() => {
    const q    = this.search().toLowerCase().trim();
    const dept = this.filterDept();
    const role = this.filterRole();
    const stat = this.filterStatus();

    let rows = this.allEmployees.filter(e => {
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

  ngOnInit() {}

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
    if (t) {
      const idx = this.allEmployees.findIndex(e => e.id === t.id);
      if (idx !== -1) this.allEmployees[idx] = { ...this.allEmployees[idx], isActive: false, status: 'inactive' };
    }
    this.deactivateTarget.set(null);
    // force re-compute
    this.allEmployees = [...this.allEmployees];
    this.search.set(this.search());
  }

  cancelDeactivate() { this.deactivateTarget.set(null); }

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
    // Update employee role in the list
    const idx = this.allEmployees.findIndex(e => e.id === emp.id);
    if (idx !== -1) {
      this.allEmployees[idx] = { 
        ...this.allEmployees[idx], 
        role: data.role as any 
      };
      this.allEmployees = [...this.allEmployees];
      this.search.set(this.search()); // force re-compute
    }
    this.closeRoleModal();
  }

  statusLabel(s: string) { return s === 'on_leave' ? 'On Leave' : (s.charAt(0).toUpperCase() + s.slice(1)); }
  roleLabel(r: string)   { return r.charAt(0).toUpperCase() + r.slice(1); }

  get activeFilters(): boolean {
    return !!(this.search() || this.filterDept() || this.filterRole() || this.filterStatus());
  }

  get selectedCount(): number { return this.selectedIds().size; }
}
