import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceService } from '../../../../core/services/performance.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { Assessment } from '../../../../core/models/performance.model';

@Component({
  selector: 'app-assessments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessments.component.html',
  styleUrl: './assessments.component.scss',
})
export class AssessmentsComponent implements OnInit {

  private readonly svc   = inject(PerformanceService);
  readonly permissions   = inject(PermissionService);
  private readonly toast = inject(ToastService);

  assessments = signal<Assessment[]>([]);
  loading     = signal(true);
  loadError   = signal<string | null>(null);

  showForm    = signal(false);
  submitting  = signal(false);

  // ── Create form fields ───────────────────────────────────────────────
  formTitle       = signal('');
  formType        = signal('');
  formDescription = signal('');
  formEmployeeIds = signal('');
  formDueDate     = signal('');

  readonly canCreate = this.permissions.isAdmin() || this.permissions.isHr();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getMyAssessments().subscribe({
      next:  (rows) => { this.assessments.set(rows); this.loading.set(false); },
      error: ()     => { this.loadError.set('Failed to load assessments.'); this.loading.set(false); },
    });
  }

  openForm(): void {
    this.formTitle.set('');
    this.formType.set('');
    this.formDescription.set('');
    this.formEmployeeIds.set('');
    this.formDueDate.set('');
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  submit(): void {
    const title = this.formTitle().trim();
    if (!title || this.submitting()) return;

    const ids = this.formEmployeeIds()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    this.submitting.set(true);
    this.svc.createAssessment({
      title,
      type:        this.formType().trim() || undefined,
      description: this.formDescription().trim() || undefined,
      assignedToEmployeeIds: ids,
      dueDate:     this.formDueDate() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Assessment created', 'The assessment has been assigned.');
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error('Failed to create', err?.error?.message ?? 'Could not create assessment.');
      },
    });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending:     'badge--amber',
      completed:   'badge--green',
      in_progress: 'badge--blue',
      draft:       'badge--gray',
    };
    return map[status] ?? 'badge--gray';
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  fmt(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
