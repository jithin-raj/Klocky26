import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../../../core/services/task.service';
import { Delegation, CreateDelegationRequest } from '../../../../core/models/task.model';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { LocalizationService } from '../../../../core/services/localization.service';

@Component({
  selector: 'app-task-delegation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-delegation.component.html',
  styleUrl: './task-delegation.component.scss',
})
export class TaskDelegationComponent implements OnInit {

  private readonly svc   = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly loc   = inject(LocalizationService);

  delegations = signal<Delegation[]>([]);
  loading     = signal(false);
  showForm    = signal(false);
  submitting  = signal(false);

  form = signal<CreateDelegationRequest>({
    delegateToEmployeeId: '',
    taskCategory: 'attendance',
    startDate: '',
  });

  readonly categoryOptions: { label: string; value: CreateDelegationRequest['taskCategory'] }[] = [
    { label: 'Attendance', value: 'attendance' },
    { label: 'Leave',      value: 'leave' },
    { label: 'Work',       value: 'work' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getDelegations().subscribe({
      next: list => { this.delegations.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  /* ── Form helpers ── */
  patchForm(patch: Partial<CreateDelegationRequest>) {
    this.form.update(f => ({ ...f, ...patch }));
  }

  openForm() {
    this.form.set({ delegateToEmployeeId: '', taskCategory: 'attendance', startDate: '' });
    this.showForm.set(true);
  }

  cancelForm() { this.showForm.set(false); }

  submit() {
    const f = this.form();
    if (!f.delegateToEmployeeId.trim() || !f.startDate) {
      this.toast.warning('Required fields', 'Please fill in Employee ID and Start Date.');
      return;
    }
    this.submitting.set(true);

    const body: CreateDelegationRequest = {
      delegateToEmployeeId: f.delegateToEmployeeId.trim(),
      taskCategory: f.taskCategory,
      startDate: f.startDate,
      ...(f.endDate  ? { endDate: f.endDate }   : {}),
      ...(f.reason   ? { reason: f.reason }      : {}),
    };

    this.svc.createDelegation(body).subscribe({
      next: created => {
        this.delegations.update(list => [created, ...list]);
        this.submitting.set(false);
        this.showForm.set(false);
        this.toast.success('Delegation created', `Delegated to ${created.delegateToName}.`);
      },
      error: err => {
        this.submitting.set(false);
        this.toast.error('Could not create', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  /* ── Delete ── */
  remove(d: Delegation) {
    if (!window.confirm(`Delete delegation to ${d.delegateToName}?`)) return;
    this.svc.deleteDelegation(d.id).subscribe({
      next: () => {
        this.delegations.update(list => list.filter(x => x.id !== d.id));
        this.toast.success('Delegation deleted');
      },
      error: err => {
        this.toast.error('Could not delete', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  /* ── Helpers ── */
  categoryLabel(cat: string): string {
    return this.categoryOptions.find(o => o.value === cat)?.label ?? cat;
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    return this.loc.formatDateOnly(iso);
  }
}
