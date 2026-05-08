import {
  Component, ChangeDetectionStrategy, signal, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MOCK_EMPLOYEES, EmployeeRow } from '../../models/employee.model';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss',
})
export class EmployeeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orgNav = inject(OrgNavigationService);

  employee = signal<EmployeeRow | null>(null);

  readonly mockAttendance = [
    { date: '2026-04-28', checkIn: '09:02', checkOut: '18:15', hours: 9.2, status: 'present' },
    { date: '2026-04-27', checkIn: '09:18', checkOut: '18:05', hours: 8.8, status: 'present' },
    { date: '2026-04-26', checkIn: '–', checkOut: '–', hours: 0, status: 'absent' },
    { date: '2026-04-25', checkIn: '08:55', checkOut: '17:50', hours: 8.9, status: 'present' },
    { date: '2026-04-24', checkIn: '09:10', checkOut: '13:00', hours: 3.8, status: 'half_day' },
  ];

  readonly mockLeaves = [
    { type: 'Casual Leave', from: '2026-03-15', to: '2026-03-16', days: 2, status: 'approved' },
    { type: 'Sick Leave',   from: '2026-02-10', to: '2026-02-11', days: 2, status: 'approved' },
    { type: 'Earned Leave', from: '2026-05-05', to: '2026-05-09', days: 5, status: 'pending'  },
  ];

  readonly mockGoals = [
    { title: 'Complete Q1 OKRs',        progress: 85, due: '2026-03-31', status: 'on_track'   },
    { title: 'Finish certification',     progress: 45, due: '2026-06-30', status: 'at_risk'    },
    { title: 'Team knowledge sessions',  progress: 100,due: '2026-04-30', status: 'completed'  },
  ];

  activeTab = signal<'overview' | 'attendance' | 'leaves' | 'performance'>('overview');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const emp = MOCK_EMPLOYEES.find(e => e.id === id) ?? null;
    this.employee.set(emp);
  }

  goBack()  { this.orgNav.navigate(['app', 'employees']); }
  editEmp() { this.orgNav.navigate(['app', 'employees', this.employee()?.id ?? '', 'edit']); }
  setTab(t: 'overview' | 'attendance' | 'leaves' | 'performance') { this.activeTab.set(t); }

  attendanceRate = 92;
  leaveBalance   = 12;

  statusClass(s: string) { return s; }
}
