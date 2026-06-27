import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, SelectOption, UiIconComponent, UiIconName } from '../../../../shared/components';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { EmployeeService } from '../../../../core/services/employee.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { AppNotification, NotificationType, NotificationAudience } from '../../../../core/models/notification.model';
import { extractApiErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiIconComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {

  private readonly notifications = inject(NotificationService);
  private readonly permissions   = inject(PermissionService);
  private readonly departmentSvc = inject(DepartmentService);
  private readonly employeeSvc   = inject(EmployeeService);
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
  target   = signal('');           // departmentId or userId, depending on audience
  type     = signal<NotificationType>('announcement');
  sending  = signal(false);
  charCount = computed(() => this.body().length);

  departments = signal<{ id: string; name: string }[]>([]);
  employees   = signal<{ id: string; name: string }[]>([]);

  readonly departmentOptions = computed<SelectOption[]>(() => [
    { label: 'Select department', value: '' },
    ...this.departments().map(d => ({ label: d.name, value: d.id })),
  ]);
  readonly employeeOptions = computed<SelectOption[]>(() => [
    { label: 'Select employee', value: '' },
    ...this.employees().map(e => ({ label: e.name, value: e.id })),
  ]);

  readonly typeOptions: SelectOption[] = [
    { label: 'Announcement', value: 'announcement' },
    { label: 'Information',  value: 'info' },
    { label: 'Success',      value: 'success' },
    { label: 'Warning',      value: 'warning' },
  ];

  readonly audienceChoices: { value: NotificationAudience; label: string }[] = [
    { value: 'all',        label: 'All Employees' },
    { value: 'department', label: 'By Department' },
    { value: 'individual', label: 'Specific Employee' },
  ];

  ngOnInit(): void {
    // Make sure the inbox is populated even on a direct deep-link to this page.
    if (!this.notifications.loaded()) this.notifications.load();
    if (this.canSend()) this.loadTargets();
  }

  setAudience(a: NotificationAudience): void {
    this.audience.set(a);
    this.target.set('');
  }

  private loadTargets(): void {
    this.departmentSvc.getAll().subscribe({
      next: (res) => this.departments.set((res.data ?? []).map((d: any) => ({ id: d.departmentId ?? d.id, name: d.name }))),
      error: () => { /* soft — leave empty */ },
    });
    this.employeeSvc.getAll().subscribe({
      next: (res) => this.employees.set((res.data ?? []).map((e: any) => ({ id: e.employeeId ?? e.id, name: `${e.fullName} — ${e.email}` }))),
      error: () => { /* soft — leave empty */ },
    });
  }

  get canSubmit(): boolean {
    if (!this.title().trim() || !this.body().trim() || this.sending()) return false;
    if (this.audience() === 'department' && !this.target()) return false;
    if (this.audience() === 'individual' && !this.target()) return false;
    return true;
  }

  clearForm(): void {
    this.title.set(''); this.body.set(''); this.target.set('');
    this.audience.set('all'); this.type.set('announcement');
  }

  send(): void {
    if (!this.canSubmit) return;
    this.sending.set(true);
    const audience = this.audience();
    this.notifications.send({
      title: this.title().trim(),
      body: this.body().trim(),
      audience,
      departmentId: audience === 'department' ? this.target() : null,
      userId: audience === 'individual' ? this.target() : null,
      type: this.type(),
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.toast.success('Notification sent', 'Your notification is on its way.');
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
