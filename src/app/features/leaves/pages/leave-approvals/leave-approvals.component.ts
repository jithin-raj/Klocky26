import {
  Component, ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type LeaveType   = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeCode: string;
  initials: string;
  avatarColor: string;
  department: string;
  leaveType: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

const COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9'];

const MOCK: LeaveRequest[] = [
  { id:'1', employeeName:'Divya Kumar',    employeeCode:'EMP013', initials:'DK', avatarColor:COLORS[4], department:'HR',          leaveType:'sick',      from:'2026-05-05', to:'2026-05-06', days:2, reason:'Fever and flu — doctor advised rest', status:'pending',  appliedOn:'2026-04-29' },
  { id:'2', employeeName:'Aman Gupta',     employeeCode:'EMP014', initials:'AG', avatarColor:COLORS[5], department:'Sales',        leaveType:'casual',    from:'2026-05-08', to:'2026-05-09', days:2, reason:'Personal work at home town',          status:'pending',  appliedOn:'2026-04-28' },
  { id:'3', employeeName:'Sneha Kapoor',   employeeCode:'EMP005', initials:'SK', avatarColor:COLORS[4], department:'Design',       leaveType:'earned',    from:'2026-05-12', to:'2026-05-16', days:5, reason:'Annual vacation',                     status:'pending',  appliedOn:'2026-04-27' },
  { id:'4', employeeName:'Rohan Desai',    employeeCode:'EMP004', initials:'RD', avatarColor:COLORS[3], department:'Engineering',  leaveType:'casual',    from:'2026-05-02', to:'2026-05-02', days:1, reason:'Family function',                     status:'approved', appliedOn:'2026-04-25' },
  { id:'5', employeeName:'Rahul Tiwari',   employeeCode:'EMP008', initials:'RT', avatarColor:COLORS[7], department:'Marketing',    leaveType:'sick',      from:'2026-04-22', to:'2026-04-23', days:2, reason:'Medical procedure',                   status:'approved', appliedOn:'2026-04-20' },
  { id:'6', employeeName:'Ishita Shah',    employeeCode:'EMP019', initials:'IS', avatarColor:COLORS[2], department:'HR',           leaveType:'unpaid',    from:'2026-04-28', to:'2026-04-28', days:1, reason:'Urgent personal matter',              status:'rejected', appliedOn:'2026-04-26' },
  { id:'7', employeeName:'Nikhil Bansal',  employeeCode:'EMP016', initials:'NB', avatarColor:COLORS[7], department:'Finance',      leaveType:'casual',    from:'2026-05-20', to:'2026-05-22', days:3, reason:'Travel plans',                        status:'pending',  appliedOn:'2026-04-30' },
  { id:'8', employeeName:'Kavya Iyer',     employeeCode:'EMP007', initials:'KI', avatarColor:COLORS[6], department:'Design',       leaveType:'earned',    from:'2026-06-01', to:'2026-06-07', days:7, reason:'Wedding function',                   status:'pending',  appliedOn:'2026-04-30' },
];

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './leave-approvals.component.html',
  styleUrl: './leave-approvals.component.scss',
})
export class LeaveApprovalsComponent {

  private all = signal<LeaveRequest[]>(MOCK);
  filterStatus = signal<string>('all');
  filterType   = signal<string>('');
  rejectReason = signal('');
  rejectTarget = signal<string | null>(null);
  detailTarget = signal<LeaveRequest | null>(null);

  readonly leaveTypes: LeaveType[] = ['casual','sick','earned','maternity','paternity','unpaid'];
  readonly leaveTypeOptions = [
    { label: 'All Leave Types', value: '' },
    ...this.leaveTypes.map(t => ({ label: this.typeLabel(t), value: t })),
  ];

  readonly filtered = computed(() => {
    return this.all().filter(r => {
      if (this.filterStatus() !== 'all' && r.status !== this.filterStatus()) return false;
      if (this.filterType() && r.leaveType !== this.filterType()) return false;
      return true;
    });
  });

  readonly counts = computed(() => ({
    pending:  this.all().filter(r => r.status === 'pending').length,
    approved: this.all().filter(r => r.status === 'approved').length,
    rejected: this.all().filter(r => r.status === 'rejected').length,
    total:    this.all().length,
  }));

  approve(id: string) {
    this.all.update(list => list.map(r => r.id === id ? { ...r, status: 'approved' } : r));
  }

  openReject(id: string) { this.rejectTarget.set(id); this.rejectReason.set(''); }
  cancelReject()         { this.rejectTarget.set(null); }

  doReject() {
    const id = this.rejectTarget();
    if (id) this.all.update(list => list.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    this.rejectTarget.set(null);
  }

  openDetail(r: LeaveRequest) { this.detailTarget.set(r); }
  closeDetail() { this.detailTarget.set(null); }

  typeLabel(t: string)   { return t.charAt(0).toUpperCase() + t.slice(1) + ' Leave'; }
  statusClass(s: string) { return s; }
}
