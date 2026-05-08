import {
  Component, ChangeDetectionStrategy, signal, computed, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MOCK_EMPLOYEES, EmployeeRow } from '../../models/employee.model';
import { RolePermissionModalComponent } from '../../components/role-permission-modal/role-permission-modal.component';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';

export interface TreeNode {
  emp: EmployeeRow;
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
  readonly orgTheme = inject(OrgThemeService);

  roots = signal<TreeNode[]>([]);
  searchQuery = signal('');
  expandedIds = signal<Set<string>>(new Set());
  
  // Role modal state
  roleModalOpen = signal(false);
  selectedEmployee = signal<EmployeeRow | null>(null);

  ngOnInit() {
    this.roots.set(this.buildTree(MOCK_EMPLOYEES));
  }

  private buildTree(employees: EmployeeRow[]): TreeNode[] {
    const map = new Map<string, TreeNode>();
    employees.forEach(e => map.set(e.id, { emp: e, children: [], expanded: true }));

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
    this.roots.set([...this.roots()]); // trigger CD
  }

  viewEmployee(id: string) { this.orgNav.navigate(['app', 'employees', id]); }
  goBack()                 { this.orgNav.navigate(['app', 'employees']); }
  
  manageRole(emp: EmployeeRow) {
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
    // this.employeeService.updateRole(this.selectedEmployee()!.id, data).subscribe(...);
    this.roleModalOpen.set(false);
    this.selectedEmployee.set(null);
  }

  expandAll() {
    this.setAll(this.roots(), true);
    this.roots.set([...this.roots()]);
  }
  collapseAll() {
    this.setAll(this.roots(), false);
    this.roots.set([...this.roots()]);
  }

  private setAll(nodes: TreeNode[], val: boolean) {
    nodes.forEach(n => { n.expanded = val; this.setAll(n.children, val); });
  }

  totalCount = computed(() => MOCK_EMPLOYEES.length);
  deptCount  = computed(() => new Set(MOCK_EMPLOYEES.map(e => e.department)).size);
}
