import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolePermissionModalComponent } from '../../components/role-permission-modal/role-permission-modal.component';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { EmployeeTreeNode, EmployeeTreeResponse } from '../../models/employee-api.model';

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

export interface TreeNode {
  emp: EmployeeTreeNode;
  department: string;
  children: TreeNode[];
  expanded: boolean;
}

@Component({
  selector: 'app-org-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RolePermissionModalComponent],
  templateUrl: './org-tree.component.html',
  styleUrl: './org-tree.component.scss',
})
export class OrgTreeComponent implements OnInit {
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  readonly orgTheme = inject(OrgThemeService);

  loading = signal(true);
  loadError = signal<string | null>(null);

  /** Department groups, each with its own root tree nodes (built from reportingManagerId within the department) */
  departmentGroups = signal<{ departmentId: string; name: string; color: string | null; roots: TreeNode[] }[]>([]);
  unassignedRoots = signal<TreeNode[]>([]);

  searchQuery = signal('');

  totalCount = signal(0);
  deptCount  = signal(0);

  // Role modal state
  roleModalOpen = signal(false);
  selectedEmployee = signal<EmployeeTreeNode | null>(null);

  /** role-permission-modal's RoleName excludes super_admin — map it onto admin for display. */
  readonly selectedEmployeeModalRole = computed<'admin' | 'hr' | 'manager' | 'employee'>(() => {
    const role = this.selectedEmployee()?.role;
    if (!role || role === 'super_admin') return 'admin';
    return role;
  });

  ngOnInit() {
    this.employeeService.getTree().subscribe({
      next: (res) => {
        this.buildFromTree(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load the org chart.');
        this.loading.set(false);
      },
    });
  }

  private buildFromTree(tree: EmployeeTreeResponse) {
    const departments = tree.departments ?? [];
    this.deptCount.set(departments.length);
    this.totalCount.set(
      departments.reduce((sum, d) => sum + d.employees.length, 0) + (tree.unassignedEmployees?.length ?? 0)
    );

    this.departmentGroups.set(
      departments.map(d => ({
        departmentId: d.departmentId,
        name: d.name,
        color: d.color,
        roots: this.buildTree(d.employees),
      }))
    );
    this.unassignedRoots.set(this.buildTree(tree.unassignedEmployees ?? []));
  }

  /** Builds manager-based nesting client-side from each node's reportingManagerId, scoped to one department's employee list. */
  private buildTree(employees: EmployeeTreeNode[]): TreeNode[] {
    const map = new Map<string, TreeNode>();
    employees.forEach(e => map.set(e.employeeId, { emp: e, department: '', children: [], expanded: true }));

    const roots: TreeNode[] = [];
    map.forEach((node) => {
      const mgr = node.emp.reportingManagerId;
      if (mgr && map.has(mgr)) {
        map.get(mgr)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  toggleNode(node: TreeNode) {
    node.expanded = !node.expanded;
    this.departmentGroups.set([...this.departmentGroups()]);
    this.unassignedRoots.set([...this.unassignedRoots()]);
  }

  initials(emp: EmployeeTreeNode) { return initialsOf(emp.fullName); }
  avatarColor(emp: EmployeeTreeNode) { return colorFor(emp.employeeId); }

  viewEmployee(id: string) { this.orgNav.navigate(['app', 'employees', id]); }
  goBack()                 { this.orgNav.navigate(['app', 'employees']); }

  manageRole(emp: EmployeeTreeNode) {
    this.selectedEmployee.set(emp);
    this.roleModalOpen.set(true);
  }

  closeRoleModal() {
    this.roleModalOpen.set(false);
    this.selectedEmployee.set(null);
  }

  onRoleChange(data: { role: string; permissions: string[] }) {
    console.log('Role updated:', data);
    // In a real app, call an API to update role and permissions
    // this.employeeService.updateRole(this.selectedEmployee()!.employeeId, data).subscribe(...);
    this.roleModalOpen.set(false);
    this.selectedEmployee.set(null);
  }

  expandAll() {
    this.departmentGroups().forEach(g => this.setAll(g.roots, true));
    this.setAll(this.unassignedRoots(), true);
    this.departmentGroups.set([...this.departmentGroups()]);
    this.unassignedRoots.set([...this.unassignedRoots()]);
  }
  collapseAll() {
    this.departmentGroups().forEach(g => this.setAll(g.roots, false));
    this.setAll(this.unassignedRoots(), false);
    this.departmentGroups.set([...this.departmentGroups()]);
    this.unassignedRoots.set([...this.unassignedRoots()]);
  }

  private setAll(nodes: TreeNode[], val: boolean) {
    nodes.forEach(n => { n.expanded = val; this.setAll(n.children, val); });
  }
}
