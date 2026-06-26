import {
  Component, ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MOCK_EMPLOYEES } from '../../../employees/models/employee.model';
import { UiSelectComponent } from '../../../../shared/components';

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  audience: 'all' | 'department' | 'individual';
  target: string;
  sentAt: string;
  status: 'sent' | 'scheduled' | 'draft';
  read?: boolean;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {

  activeTab = signal<'send' | 'history'>('send');

  // Compose form
  title     = signal('');
  body      = signal('');
  channel   = signal<'push' | 'email' | 'sms' | 'in_app'>('in_app');
  audience  = signal<'all' | 'department' | 'individual'>('all');
  target    = signal('');
  schedule  = signal('');
  isSending = signal(false);
  sent      = signal(false);
  charCount = computed(() => this.body().length);

  readonly channels   = [
    { value: 'in_app', label: 'In-App', icon: '🔔' },
    { value: 'push',   label: 'Push',   icon: '📱' },
    { value: 'email',  label: 'Email',  icon: '✉️' },
    { value: 'sms',    label: 'SMS',    icon: '💬' },
  ] as const;

  readonly departments = ['Engineering','Design','HR','Sales','Marketing','Finance','Operations'];
  readonly employees   = MOCK_EMPLOYEES;

  readonly departmentOptions = [
    { label: 'Select department', value: '' },
    ...this.departments.map(d => ({ label: d, value: d })),
  ];
  readonly employeeOptions = [
    { label: 'Select employee', value: '' },
    ...this.employees.map(e => ({ label: `${e.fullName} – ${e.department}`, value: e.id })),
  ];

  private _history = signal<Notification[]>([
    { id:'1', title:'Holiday Notice',           body:'Office closed on May 1st – Labour Day.',          channel:'in_app', audience:'all',        target:'All Employees',  sentAt:'2026-04-28 10:00', status:'sent' },
    { id:'2', title:'Q1 Performance Review',    body:'Please complete your self-assessment by Apr 30.', channel:'email',  audience:'all',        target:'All Employees',  sentAt:'2026-04-25 09:30', status:'sent' },
    { id:'3', title:'Fire Drill – Engineering', body:'Fire drill scheduled for 3 PM today.',            channel:'push',   audience:'department', target:'Engineering',    sentAt:'2026-04-22 14:00', status:'sent' },
    { id:'4', title:'Welcome Aboard Sakshi',    body:'Please welcome our newest team member Sakshi.',   channel:'in_app', audience:'all',        target:'All Employees',  sentAt:'2026-04-15 11:00', status:'sent' },
    { id:'5', title:'System Maintenance',       body:'App will be offline 1–3 AM on May 5th.',          channel:'email',  audience:'all',        target:'All Employees',  sentAt:'2026-05-03 09:00', status:'scheduled' },
  ]);

  readonly history = this._history.asReadonly();

  sendNotification() {
    if (!this.title().trim() || !this.body().trim()) return;
    this.isSending.set(true);
    setTimeout(() => {
      this._history.update(h => [{
        id: Date.now().toString(),
        title: this.title(),
        body: this.body(),
        channel: this.channel(),
        audience: this.audience(),
        target: this.audience() === 'all' ? 'All Employees'
              : this.audience() === 'department' ? this.target()
              : this.employees.find(e => e.id === this.target())?.fullName ?? 'Unknown',
        sentAt: new Date().toLocaleString(),
        status: this.schedule() ? 'scheduled' : 'sent',
      }, ...h]);
      this.isSending.set(false);
      this.sent.set(true);
      this.title.set(''); this.body.set(''); this.schedule.set('');
      setTimeout(() => this.sent.set(false), 2500);
    }, 900);
  }

  channelIcon(c: string) {
    return this.channels.find(ch => ch.value === c)?.icon ?? '🔔';
  }

  channelLabel(c: string) {
    return this.channels.find(ch => ch.value === c)?.label ?? c;
  }
}
