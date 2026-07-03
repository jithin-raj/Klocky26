import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecruitmentService } from '../../../../core/services/recruitment.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { JobPosting } from '../../../../core/models/recruitment.model';

type TypeFilter = 'all' | 'full_time' | 'part_time' | 'contract';

@Component({
  selector: 'app-jobs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.scss',
})
export class JobsComponent implements OnInit {

  private readonly svc   = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  private all = signal<JobPosting[]>([]);
  loading     = signal(true);
  typeFilter  = signal<TypeFilter>('all');

  readonly filterOptions: { label: string; value: TypeFilter }[] = [
    { label: 'All',        value: 'all' },
    { label: 'Full-time',  value: 'full_time' },
    { label: 'Part-time',  value: 'part_time' },
    { label: 'Contract',   value: 'contract' },
  ];

  readonly jobs = computed(() => {
    const f = this.typeFilter();
    return f === 'all' ? this.all() : this.all().filter(j => j.type === f);
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getJobs().subscribe({
      next: (list) => { this.all.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); this.toast.error('Failed to load job openings'); },
    });
  }

  setFilter(v: TypeFilter) { this.typeFilter.set(v); }

  typeLabel(t: string): string {
    return { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' }[t] ?? t;
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
}
