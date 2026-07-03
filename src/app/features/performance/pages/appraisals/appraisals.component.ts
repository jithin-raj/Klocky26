import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceService } from '../../../../core/services/performance.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { Appraisal } from '../../../../core/models/performance.model';

@Component({
  selector: 'app-appraisals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './appraisals.component.html',
  styleUrl: './appraisals.component.scss',
})
export class AppraisalsComponent implements OnInit {

  private readonly svc         = inject(PerformanceService);
  readonly permissions         = inject(PermissionService);

  appraisals = signal<Appraisal[]>([]);
  loading    = signal(true);
  loadError  = signal<string | null>(null);

  readonly isPrivileged = this.permissions.isAdmin() || this.permissions.isHr();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const call$ = this.isPrivileged
      ? this.svc.getAllAppraisals()
      : this.svc.getMyAppraisals();

    call$.subscribe({
      next:  (rows) => { this.appraisals.set(rows); this.loading.set(false); },
      error: ()     => { this.loadError.set('Failed to load appraisals.'); this.loading.set(false); },
    });
  }

  stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
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
