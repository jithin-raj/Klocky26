import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiMultiSelectComponent, MultiSelectOption, UiIconComponent, UiIconName } from '../../../../shared/components';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { OrgRoleService } from '../../../../core/services/org-role.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { AppNotification, NotificationType, NotificationAudience } from '../../../../core/models/notification.model';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiMultiSelectComponent, UiIconComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {

  private readonly notifications = inject(NotificationService);
  private readonly permissions   = inject(PermissionService);
  private readonly employeeSvc   = inject(EmployeeService);
  private readonly departmentSvc = inject(DepartmentService);
  private readonly orgRoleSvc    = inject(OrgRoleService);
  private readonly toast         = inject(ToastService);

  // Send needs add/edit on the notifications key (level 2); admins always pass.
  readonly canSend = computed(() => this.permissions.can('notifications', 2));

  activeTab = signal<'inbox' | 'send'>('inbox');

  // ── Inbox ────────────────────────────────────────────────────────
  readonly items = computed(() => this.notifications.items());
  readonly unread = computed(() => this.notifications.unreadCount());
  readonly loading = computed(() => this.notifications.loading());

  open(n: AppNotification): void {
    this.notifications.markRead(n.id);
  }
  markAllRead(): void {
    this.notifications.markAllRead();
  }

  // ── Compose ──────────────────────────────────────────────────────
  title    = signal('');
  body     = signal('');
  audience = signal<NotificationAudience>('all');
  sending  = signal(false);
  charCount = computed(() => this.body().length);

  // Selected ids per targeting mode (multi-select).
  selectedEmployees   = signal<string[]>([]);
  selectedDepartments = signal<string[]>([]);
  selectedRoles       = signal<string[]>([]);

  // Picker source lists.
  employees   = signal<{ id: string; name: string }[]>([]);
  departments = signal<{ id: string; name: string }[]>([]);
  roles       = signal<{ id: string; name: string }[]>([]);

  readonly employeeOptions = computed<MultiSelectOption[]>(() =>
    this.employees().map(e => ({ label: e.name, value: e.id })));
  readonly departmentOptions = computed<MultiSelectOption[]>(() =>
    this.departments().map(d => ({ label: d.name, value: d.id })));
  readonly roleOptions = computed<MultiSelectOption[]>(() =>
    this.roles().map(r => ({ label: r.name, value: r.id })));

  readonly audienceChoices: { value: NotificationAudience; label: string }[] = [
    { value: 'all',        label: 'Everyone (org-wide)' },
    { value: 'employees',  label: 'Specific Employees' },
    { value: 'department', label: 'By Department' },
    { value: 'role',       label: 'By Role' },
  ];

  ngOnInit(): void {
    // Make sure the inbox is populated even on a direct deep-link to this page.
    if (!this.notifications.loaded()) this.notifications.load();
    if (this.canSend()) this.loadTargets();
  }

  setAudience(a: NotificationAudience): void {
    this.audience.set(a);
    // Reset selections so a hidden picker never carries over into the payload.
    this.selectedEmployees.set([]);
    this.selectedDepartments.set([]);
    this.selectedRoles.set([]);
  }

  private loadTargets(): void {
    this.employeeSvc.getAll().subscribe({
      next: (res) => this.employees.set((res.data ?? []).map((e: any) => ({ id: e.employeeId ?? e.id, name: `${e.fullName} — ${e.email}` }))),
      error: () => { /* soft — leave empty */ },
    });
    this.departmentSvc.getAll().subscribe({
      next: (res) => this.departments.set((res.data ?? []).map(d => ({ id: d.departmentId, name: d.name }))),
      error: () => { /* soft — leave empty */ },
    });
    this.orgRoleSvc.getAll().subscribe({
      next: (res) => this.roles.set((res.data ?? []).map(r => ({ id: r.id, name: r.name }))),
      error: () => { /* soft — leave empty */ },
    });
  }

  get canSubmit(): boolean {
    if (!this.title().trim() || !this.body().trim() || this.sending()) return false;
    switch (this.audience()) {
      case 'employees':  return this.selectedEmployees().length > 0;
      case 'department': return this.selectedDepartments().length > 0;
      case 'role':       return this.selectedRoles().length > 0;
      case 'all':        return true;
    }
  }

  clearForm(): void {
    this.title.set(''); this.body.set('');
    this.setAudience('all');
  }

  send(): void {
    if (!this.canSubmit) return;
    const mode = this.audience();
    this.sending.set(true);
    this.notifications.send({
      title: this.title().trim(),
      body: this.body().trim(),
      toAll:         mode === 'all',
      userIds:       mode === 'employees'  ? this.selectedEmployees()   : undefined,
      departmentIds: mode === 'department' ? this.selectedDepartments() : undefined,
      orgRoleIds:    mode === 'role'       ? this.selectedRoles()       : undefined,
    }).subscribe({
      next: (res) => {
        this.sending.set(false);
        const count = res?.sentTo ?? 0;
        this.toast.success(
          'Notification sent',
          res?.orgWide ? 'Sent to everyone in your organization.'
                       : `Sent to ${count} ${count === 1 ? 'person' : 'people'}.`,
        );
        this.clearForm();
        this.activeTab.set('inbox');
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error('Could not send', extractApiErrorMessage(err, 'The notification could not be sent.'));
      },
    });
  }

  // ── Display helpers ──────────────────────────────────────────────
  icon(type: NotificationType): UiIconName {
    const map: Record<NotificationType, UiIconName> = {
      info: 'bell', success: 'check-circle', warning: 'bell-dot',
      attendance: 'clock', leave: 'calendar', announcement: 'megaphone', system: 'settings',
    };
    return map[type] ?? 'bell';
  }
  color(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      info: '#6366f1', success: '#10b981', warning: '#f59e0b',
      attendance: '#0ea5e9', leave: '#8b5cf6', announcement: '#ec4899', system: '#64748b',
    };
    return map[type] ?? '#6366f1';
  }
  when(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
