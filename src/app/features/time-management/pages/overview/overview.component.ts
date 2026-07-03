import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { TimeManagementService } from '../../../../core/services/time-management.service';
import { TimeOverview, UpcomingEventItem } from '../../../../core/models/time-management.model';
import { UiLoaderComponent } from '../../../../shared/components/ui-loader/ui-loader.component';

@Component({
  selector: 'app-time-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiLoaderComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class TimeOverviewComponent implements OnInit {
  private readonly svc = inject(TimeManagementService);

  overview = signal<TimeOverview | null>(null);
  events   = signal<UpcomingEventItem[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);

  statusLabel = computed(() => {
    const s = this.overview()?.status;
    switch (s) {
      case 'present':  return 'Present';
      case 'absent':   return 'Absent';
      case 'on_leave': return 'On Leave';
      case 'wfh':      return 'WFH';
      default:         return '—';
    }
  });

  statusColor = computed(() => {
    const s = this.overview()?.status;
    switch (s) {
      case 'present':  return '#22c55e';
      case 'absent':   return '#ef4444';
      case 'on_leave': return '#f59e0b';
      case 'wfh':      return '#3b82f6';
      default:         return '#94a3b8';
    }
  });

  workHours = computed(() => {
    const mins = this.overview()?.workDurationMinutes ?? 0;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  });

  ngOnInit(): void {
    forkJoin({
      overview: this.svc.getOverview(),
      events:   this.svc.getUpcomingEvents(30),
    }).subscribe({
      next: ({ overview, events }) => {
        this.overview.set(overview);
        this.events.set(events);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load time management overview.');
        this.loading.set(false);
      },
    });
  }
}
