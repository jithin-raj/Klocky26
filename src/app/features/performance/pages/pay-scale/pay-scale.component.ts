import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceService } from '../../../../core/services/performance.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { PayBand, PayBandInput } from '../../../../core/models/performance.model';

@Component({
  selector: 'app-pay-scale',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './pay-scale.component.html',
  styleUrl: './pay-scale.component.scss',
})
export class PayScaleComponent implements OnInit {

  private readonly svc         = inject(PerformanceService);
  readonly permissions         = inject(PermissionService);
  private readonly toast       = inject(ToastService);

  bands     = signal<PayBand[]>([]);
  loading   = signal(true);
  loadError = signal<string | null>(null);
  editing   = signal(false);
  saving    = signal(false);

  /** Mutable copy used while in edit mode. */
  editRows = signal<PayBandInput[]>([]);

  readonly canEdit = this.permissions.isAdmin() || this.permissions.isHr();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getPayScale().subscribe({
      next:  (rows) => { this.bands.set(rows); this.loading.set(false); },
      error: ()     => { this.loadError.set('Failed to load pay scale.'); this.loading.set(false); },
    });
  }

  startEdit(): void {
    const draft: PayBandInput[] = this.bands().map(b => ({
      grade:      b.grade,
      title:      b.title ?? '',
      minSalary:  b.minSalary,
      midSalary:  b.midSalary ?? undefined,
      maxSalary:  b.maxSalary,
      currency:   b.currency ?? '',
      sortOrder:  b.sortOrder,
    }));
    this.editRows.set(draft);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editRows.set([]);
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.svc.updatePayScale(this.editRows()).subscribe({
      next: (updated) => {
        this.bands.set(updated);
        this.saving.set(false);
        this.editing.set(false);
        this.editRows.set([]);
        this.toast.success('Pay scale saved', 'Changes have been applied.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Save failed', err?.error?.message ?? 'Could not update pay scale.');
      },
    });
  }

  /** Forces signal update after ngModel mutates an object in the array. */
  refreshEdit(): void { this.editRows.set([...this.editRows()]); }

  /** Track by index for ngFor on editable rows. */
  trackIdx(i: number): number { return i; }

  fmt(n: number | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('en-IN');
  }
}
