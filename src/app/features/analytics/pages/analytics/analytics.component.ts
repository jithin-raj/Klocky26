import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';

@Component({
  selector: 'app-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent {
  activeReport = signal<'headcount' | 'attendance' | 'leaves' | 'turnover'>('headcount');
  period       = signal('2026-Q2');

  readonly periodOptions = [
    { label: 'Q1 2026', value: '2026-Q1' },
    { label: 'Q2 2026', value: '2026-Q2' },
    { label: 'Q4 2025', value: '2025-Q4' },
  ];

  readonly reportOptions = [
    { value: 'headcount',  label: 'Headcount',       icon: '👥' },
    { value: 'attendance', label: 'Attendance',       icon: '📅' },
    { value: 'leaves',     label: 'Leave Analytics',  icon: '🏖' },
    { value: 'turnover',   label: 'Turnover',         icon: '🔄' },
  ] as const;

  // Headcount
  readonly headcountByDept = [
    { dept: 'Engineering', count: 7, pct: 35 },
    { dept: 'Design',      count: 3, pct: 15 },
    { dept: 'Sales',       count: 3, pct: 15 },
    { dept: 'HR',          count: 4, pct: 20 },
    { dept: 'Finance',     count: 2, pct: 10 },
    { dept: 'Operations',  count: 1, pct: 5  },
  ];

  readonly headcountByRole = [
    { role: 'Employee', count: 14, color: '#6366f1' },
    { role: 'Manager',  count: 3,  color: '#22c55e' },
    { role: 'HR',       count: 2,  color: '#ec4899' },
    { role: 'Admin',    count: 1,  color: '#f59e0b' },
  ];

  // Attendance (monthly avg)
  readonly attendanceTrend = [
    { month: 'Jan', present: 94, late: 4, absent: 2 },
    { month: 'Feb', present: 91, late: 5, absent: 4 },
    { month: 'Mar', present: 96, late: 3, absent: 1 },
    { month: 'Apr', present: 93, late: 4, absent: 3 },
    { month: 'May', present: 0,  late: 0, absent: 0 },
  ];

  // Leave usage
  readonly leaveByType = [
    { type: 'Casual',    used: 28, total: 36, color: '#6366f1' },
    { type: 'Sick',      used: 15, total: 24, color: '#ec4899' },
    { type: 'Earned',    used: 42, total: 60, color: '#22c55e' },
    { type: 'Maternity', used: 0,  total: 2,  color: '#f59e0b' },
    { type: 'Unpaid',    used: 3,  total: 0,  color: '#ef4444' },
  ];

  // Turnover
  readonly turnoverData = [
    { month: 'Jan', hired: 2, left: 0 },
    { month: 'Feb', hired: 0, left: 1 },
    { month: 'Mar', hired: 3, left: 1 },
    { month: 'Apr', hired: 1, left: 0 },
  ];

  readonly summaryCards = [
    { label: 'Total Employees', value: '20',   trend: '+3 this month',   up: true  },
    { label: 'Avg Attendance',  value: '93.5%', trend: '+1.2% vs last Q', up: true  },
    { label: 'Leave Requests',  value: '8',    trend: 'pending approval', up: null  },
    { label: 'Turnover Rate',   value: '2.5%', trend: '–0.5% vs last Q', up: false },
  ];

  exportReport() {
    // In real app: generate CSV/PDF server-side or via library
    alert('Export triggered – connect to real API for CSV/PDF download');
  }
}
