import {
  Component, ChangeDetectionStrategy, signal, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { EmployeeHierarchyNode, EmployeeResponse } from '../../models/employee-api.model';

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

/** Admins/super_admins have full org-wide rights — float them to the top of
 *  the root list rather than letting them land wherever an unmanaged regular
 *  employee would, so the chart always reads "leadership first." Only
 *  matters as a tiebreaker among roots with no orgRoleHierarchyLevel, since
 *  that field (when present) is now the primary sort. */
function rootRank(role: string): number {
  if (role === 'super_admin') return 0;
  if (role === 'admin') return 1;
  return 2;
}

export interface TreeNode {
  emp: EmployeeHierarchyNode;
  managerName: string | null;
  children: TreeNode[];
  expanded: boolean;
}

@Component({
  selector: 'app-org-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './org-tree.component.html',
  styleUrl: './org-tree.component.scss',
})
export class OrgTreeComponent implements OnInit {
  private orgNav = inject(OrgNavigationService);
  private employeeService = inject(EmployeeService);
  private appState = inject(AppStateService);
  readonly orgTheme = inject(OrgThemeService);

  /** Admin is omitted from the personal "my-view", so admins default to (and only see) the full org. */
  readonly isAdmin = !!this.appState.user()?.isAdmin;

  loading = signal(true);
  loadError = signal<string | null>(null);

  /**
   * GET /api/employees/hierarchy (EMPLOYEE_FEATURE_INTEGRATION.md §2.5) — the
   * true reporting-chain org chart, rooted at employees with no manager
   * (the CEO level), nested recursively by who-reports-to-whom. This is
   * deliberately NOT the department-grouped GET /api/employees/tree — that
   * one's a department-roster view, this one's the real org chart, and it
   * carries orgRoleName/orgRoleHierarchyLevel per node so leadership tiers
   * (CEO/VP/CTO/etc.) can be styled distinctly. It does not carry department
   * membership at all — that's intentional, see the detail panel instead.
   */
  roots = signal<TreeNode[]>([]);
  totalCount = signal(0);

  /**
   * Which slice is shown (spec §9): 'my' = GET /hierarchy/my-view (always
   * allowed — caller's chain + self + reports, the default), 'full' = the
   * org-wide GET /hierarchy, lazy-loaded on demand via "View full org".
   */
  viewMode = signal<'my' | 'full'>('my');

  // ── Detail panel (opened by clicking a card) ───────────────────────────
  detailNode    = signal<TreeNode | null>(null);
  detailFull    = signal<EmployeeResponse | null>(null);
  detailLoading = signal(false);
  detailError   = signal<string | null>(null);

  ngOnInit() {
    // Admins aren't part of their own reporting chain → open straight on the full org.
    this.loadView(this.isAdmin ? 'full' : 'my');
  }

  /** Loads either the personal view (always allowed) or the full org tree. */
  loadView(mode: 'my' | 'full') {
    this.loading.set(true);
    this.loadError.set(null);
    const req$ = mode === 'my'
      ? this.employeeService.getMyHierarchyView()
      : this.employeeService.getHierarchy();
    req$.subscribe({
      next: (res) => {
        this.buildFromHierarchy(this.normalizeNodes(res.data));
        this.viewMode.set(mode);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load the org chart.');
        this.loading.set(false);
      },
    });
  }

  viewFullOrg() { this.loadView('full'); }
  viewMyOrg() { this.loadView('my'); }

  /**
   * GET /hierarchy returns a root array, but GET /hierarchy/my-view returns the
   * caller's single chain root (an object, not an array) — and some shapes wrap
   * it as { self, reports } / { root }. Normalize all of these to a root array
   * so the chart renders regardless of which endpoint fed it.
   */
  private normalizeNodes(data: unknown): EmployeeHierarchyNode[] {
    if (!data) return [];
    if (Array.isArray(data)) return data as EmployeeHierarchyNode[];
    const obj = data as Record<string, any>;
    // Looks like a single hierarchy node.
    if (obj['employeeId']) return [obj as EmployeeHierarchyNode];
    // Common wrapper keys.
    for (const key of ['root', 'self', 'node', 'tree', 'hierarchy']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as EmployeeHierarchyNode[];
      if (v && typeof v === 'object' && v.employeeId) return [v as EmployeeHierarchyNode];
    }
    return [];
  }

  private buildFromHierarchy(nodes: EmployeeHierarchyNode[]) {
    let count = 0;
    const wrap = (emp: EmployeeHierarchyNode, managerName: string | null): TreeNode => {
      count++;
      const node: TreeNode = { emp, managerName, children: [], expanded: true };
      node.children = (emp.reports ?? [])
        .map(child => wrap(child, emp.fullName))
        .sort((a, b) => this.compareNodes(a, b));
      return node;
    };

    const roots = nodes.map(n => wrap(n, null)).sort((a, b) => this.compareNodes(a, b));
    this.totalCount.set(count);
    this.roots.set(roots);
  }

  /** Lower orgRoleHierarchyLevel (more senior) sorts first; falls back to the
   *  base-role rank, then name, when neither side has a role assigned. */
  private compareNodes(a: TreeNode, b: TreeNode): number {
    const la = a.emp.orgRoleHierarchyLevel;
    const lb = b.emp.orgRoleHierarchyLevel;
    if (la != null && lb != null && la !== lb) return la - lb;
    if (la != null && lb == null) return -1;
    if (la == null && lb != null) return 1;
    const diff = rootRank(a.emp.role) - rootRank(b.emp.role);
    return diff !== 0 ? diff : a.emp.fullName.localeCompare(b.emp.fullName);
  }

  toggleNode(node: TreeNode, event?: Event) {
    event?.stopPropagation();
    node.expanded = !node.expanded;
    this.roots.set([...this.roots()]);
  }

  initials(emp: EmployeeHierarchyNode) { return initialsOf(emp.fullName); }
  avatarColor(emp: EmployeeHierarchyNode) { return colorFor(emp.employeeId); }

  /** Visual tier for leadership styling — 1-2 get an accent treatment, everything else (incl. unassigned) is plain. */
  tierClass(emp: EmployeeHierarchyNode): string {
    const lvl = emp.orgRoleHierarchyLevel;
    if (lvl === 1) return 'ot-tier-1';
    if (lvl === 2) return 'ot-tier-2';
    return '';
  }

  goBack() { this.orgNav.navigate(['app', 'employees']); }

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

  // ── Detail panel ────────────────────────────────────────────────────────

  openDetail(node: TreeNode, event?: Event) {
    event?.stopPropagation();
    this.detailNode.set(node);
    this.detailFull.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.employeeService.getById(node.emp.employeeId).subscribe({
      next: (res) => { this.detailFull.set(res.data); this.detailLoading.set(false); },
      error: () => { this.detailError.set('Could not load employee details.'); this.detailLoading.set(false); },
    });
  }

  closeDetail() {
    this.detailNode.set(null);
    this.detailFull.set(null);
    this.detailError.set(null);
  }

  editFromDetail() {
    const id = this.detailNode()?.emp.employeeId;
    if (id) this.orgNav.navigate(['app', 'employees', id, 'edit']);
  }
}
