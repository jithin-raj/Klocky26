import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { LeaveService } from '../../../../core/services/leave.service';
import {
  HalfDaySession, LeaveBalance, LeaveRequestView, LeaveTypeOption,
} from '../../../../core/models/leave.model';

@Component({
  selector: 'app-my-leaves',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './my-leaves.component.html',
  styleUrl: './my-leaves.component.scss',
})
export class MyLeavesComponent implements OnInit {

  private readonly svc = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly todayIso = new Date().toISOString().slice(0, 10);

  // ── Reference data ───────────────────────────────────────────────
  types = signal<LeaveTypeOption[]>([]);
  balances = signal<LeaveBalance[]>([]);
  readonly typeOptions = computed(() =>
    this.types().map(t => ({ label: t.name, value: t.leaveTypeId })));

  // ── Apply form ───────────────────────────────────────────────────
  leaveTypeId    = signal('');
  fromDate       = signal(this.todayIso);
  toDate         = signal(this.todayIso);
  halfDay        = signal(false);
  halfDaySession = signal<HalfDaySession>('first_half');
  workedDate     = signal('');
  reason         = signal('');
  submitting     = signal(false);

  readonly selectedType = computed(() =>
    this.types().find(t => t.leaveTypeId === this.leaveTypeId()) ?? null);
  readonly isCompOff = computed(() => !!this.selectedType()?.isCompOff);
  readonly selectedBalance = computed(() =>
    this.balances().find(b => b.leaveTypeId === this.leaveTypeId()) ?? null);

  readonly sessionOptions = [
    { label: 'First half', value: 'first_half' },
    { label: 'Second half', value: 'second_half' },
  ];

  readonly canSubmit = computed(() => {
    if (!this.leaveTypeId() || !this.fromDate() || !this.toDate() || this.submitting()) return false;
    if (this.toDate() < this.fromDate()) return false;
    if (this.halfDay() && this.fromDate() !== this.toDate()) return false;
    if (this.isCompOff() && !this.workedDate()) return false;
    return true;
  });

  // ── My requests ──────────────────────────────────────────────────
  mine = signal<LeaveRequestView[]>([]);
  loadingMine = signal(true);
  busyId = signal<string | null>(null);

  ngOnInit() {
    this.loadRefs();
    this.loadMine();
  }

  private loadRefs() {
    this.svc.types().subscribe({ next: t => this.types.set(t), error: () => {} });
    this.svc.balances().subscribe({ next: b => this.balances.set(b), error: () => {} });
  }

  loadMine() {
    this.loadingMine.set(true);
    this.svc.mine().subscribe({
      next: (rows) => { this.mine.set(rows); this.loadingMine.set(false); },
      error: () => { this.loadingMine.set(false); },
    });
  }

  /** Half-day is a single day — keep toDate pinned to fromDate while it's on. */
  onHalfDayToggle(on: boolean) {
    this.halfDay.set(on);
    if (on) this.toDate.set(this.fromDate());
  }
  onFromChange(v: string) {
    this.fromDate.set(v);
    if (this.halfDay() || this.toDate() < v) this.toDate.set(v);
  }

  submit() {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.svc.create({
      leaveTypeId: this.leaveTypeId(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      reason: this.reason() || undefined,
      halfDay: this.halfDay(),
      halfDaySession: this.halfDay() ? this.halfDaySession() : undefined,
      workedDate: this.isCompOff() ? (this.workedDate() || undefined) : undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Leave applied', 'Your leave request has been submitted.');
        this.reason.set(''); this.workedDate.set(''); this.halfDay.set(false);
        this.loadMine();
        this.svc.balances().subscribe({ next: b => this.balances.set(b), error: () => {} });
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error('Could not apply', err?.error?.message ?? 'Your leave request could not be submitted.');
      },
    });
  }

  cancel(id: string) {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.svc.cancel(id).subscribe({
      next: () => { this.busyId.set(null); this.loadMine(); },
      error: (err) => { this.busyId.set(null); this.toast.error('Could not cancel', err?.error?.message ?? 'Please try again.'); },
    });
  }

  /** Pending can always be cancelled; approved only before it starts. */
  canCancel(r: LeaveRequestView): boolean {
    if (r.status === 'pending') return true;
    return r.status === 'approved' && r.fromDate > this.todayIso;
  }

  stageLabel(stage: string): string {
    if (stage === 'manager') return 'Awaiting manager';
    if (stage === 'hr') return 'Awaiting HR';
    return '';
  }
}
