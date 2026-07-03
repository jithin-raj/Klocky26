import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { TimeManagementService } from '../../../../core/services/time-management.service';
import { AttendanceStateService } from '../../../../core/services/attendance-state.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { TimeOverview, UpcomingEventItem } from '../../../../core/models/time-management.model';
import { TeamAttendanceItem } from '../../../../core/models/attendance.model';
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
  private readonly svc            = inject(TimeManagementService);
  private readonly attendanceSvc  = inject(AttendanceStateService);
  private readonly appState       = inject(AppStateService);

  overview    = signal<TimeOverview | null>(null);
  events      = signal<UpcomingEventItem[]>([]);
  loading     = signal(true);
  error       = signal<string | null>(null);

  teamItems   = signal<TeamAttendanceItem[]>([]);
  teamLoading = signal(false);

  readonly isPrivileged = computed(() => {
    const role = this.appState.userRole();
    return role === 'admin' || role === 'hr' || role === 'manager' || role === 'super_admin';
  });

  readonly clockedInEmployees = computed(() =>
    this.teamItems().filter(e => !!e.today?.isClockedIn)
  );

  readonly absentEmployees = computed(() =>
    this.teamItems().filter(e => {
      const t = e.today;
      if (!t) return true;
      return t.status === 'absent' && !t.isClockedIn;
    })
  );

  readonly onLeaveEmployees = computed(() =>
    this.teamItems().filter(e => e.today?.status === 'leave')
  );

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
        if (this.isPrivileged()) {
          this._loadTeam();
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load time management overview.');
        this.loading.set(false);
      },
    });
  }

  private _loadTeam(): void {
    this.teamLoading.set(true);
    this.attendanceSvc.getTeamStatus().subscribe({
      next: (res) => {
        this.teamItems.set(res.data ?? []);
        this.teamLoading.set(false);
      },
      error: () => this.teamLoading.set(false),
    });
  }

  formatClockIn(item: TeamAttendanceItem): string {
    const t = item.today?.clockInTime;
    if (!t) return '—';
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  trackById(_: number, item: TeamAttendanceItem): string {
    return item.userId;
  }
}
