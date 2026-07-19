import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';
import { LeaveService } from '../../../../core/services/leave.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { OrgDateOnlyPipe, OrgDatePipe } from '../../../../shared/pipes/localization.pipes';
import { LeaveApprovalStage, LeaveRequestView } from '../../../../core/models/leave.model';

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, OrgDateOnlyPipe, OrgDatePipe],
  templateUrl: './leave-approvals.component.html',
  styleUrl: './leave-approvals.component.scss',
})
export class LeaveApprovalsComponent implements OnInit {

  private readonly leaveSvc = inject(LeaveService);
  private readonly appState = inject(AppStateService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  /** Approvals are manager/HR-only; gate the call so employees don't 403 → /404. */
  private readonly canApprove = (() => {
    const u = this.appState.user();
    return !!(u?.isManager || u?.isHr || u?.isAdmin);
  })();

  /** "Process absences now" needs leaves full access (level 3). */
  readonly canProcessAbsences = computed(() => this.permissions.can('leaves', 3));
  processingAbsences = signal(false);

  // Manager/HR queue — GET /leave-requests/pending-approval returns only what the
  // caller can act on at the current stage.
  private all = signal<LeaveRequestView[]>([]);
  loading   = signal(true);
  loadError = signal<string | null>(null);
  busyId    = signal<string | null>(null);

  filterStatus = signal<string>('all');
  filterType   = signal<string>('');
  rejectReason = signal('');
  rejectTarget = signal<string | null>(null);
  detailTarget = signal<LeaveRequestView | null>(null);

  readonly leaveTypeOptions = computed(() => {
    const types = Array.from(new Set(this.all().map(r => r.leaveTypeName).filter(Boolean)));
    return [{ label: 'All Leave Types', value: '' }, ...types.map(t => ({ label: this.typeLabel(t), value: t }))];
  });

  readonly filtered = computed(() =>
    this.all().filter(r => {
      if (this.filterStatus() !== 'all' && r.status !== this.filterStatus()) return false;
      if (this.filterType() && r.leaveTypeName !== this.filterType()) return false;
      return true;
    }));

  readonly counts = computed(() => ({
    pending:  this.all().filter(r => r.status === 'pending').length,
    approved: this.all().filter(r => r.status === 'approved').length,
    rejected: this.all().filter(r => r.status === 'rejected').length,
    total:    this.all().length,
  }));

  ngOnInit() { this.load(); }

  load() {
    if (!this.canApprove) {
      this.loadError.set('You don’t have access to leave approvals.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.leaveSvc.pendingApproval().subscribe({
      next: (rows) => { this.all.set(rows); this.loading.set(false); },
      error: () => { this.loadError.set('Failed to load leave requests.'); this.loading.set(false); },
    });
  }

  /** On-demand run of the auto-absence-deduction sweep — shows the server's message verbatim. */
  processAbsences() {
    if (this.processingAbsences()) return;
    this.processingAbsences.set(true);
    this.leaveSvc.processAbsences(7).subscribe({
      next: (res) => {
        this.processingAbsences.set(false);
        // The message explains any no-op (disabled / nothing to charge / no balance).
        if (res.daysCharged > 0) {
          this.toast.success('Absences processed', res.message);
        } else {
          this.toast.info('Absences processed', res.message);
        }
      },
      error: (err) => {
        this.processingAbsences.set(false);
        const status = err?.status;
        const msg = err?.error?.message ?? err?.error?.error;
        if (status === 403) this.toast.error('Not permitted', msg ?? 'You need full leave access for this action.');
        else this.toast.error('Could not process absences', msg ?? 'Please try again.');
      },
    });
  }

  approve(id: string) {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.leaveSvc.decision(id, { approve: true }).subscribe({
      next: () => { this._remove(id); this.busyId.set(null); },
      error: () => { this.busyId.set(null); },
    });
  }

  openReject(id: string) { this.rejectTarget.set(id); this.rejectReason.set(''); }
  cancelReject()         { this.rejectTarget.set(null); }

  doReject() {
    const id = this.rejectTarget();
    if (!id) return;
    this.busyId.set(id);
    this.leaveSvc.decision(id, { approve: false, rejectionReason: this.rejectReason() || undefined }).subscribe({
      next: () => { this._remove(id); this.rejectTarget.set(null); this.busyId.set(null); },
      error: () => { this.busyId.set(null); },
    });
  }

  private _remove(id: string) { this.all.update(list => list.filter(r => r.id !== id)); }

  openDetail(r: LeaveRequestView) { this.detailTarget.set(r); }
  closeDetail() { this.detailTarget.set(null); }

  /** Comp-off shows two stages (manager → HR); surface which one a request awaits. */
  stageLabel(stage: LeaveApprovalStage): string {
    if (stage === 'manager') return 'Awaiting manager';
    if (stage === 'hr') return 'Awaiting HR';
    return '';
  }

  typeLabel(t: string)   { return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Leave'; }
  statusClass(s: string) { return s; }
}
