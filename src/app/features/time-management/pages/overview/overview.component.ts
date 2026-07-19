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
import { LocalizationService } from '../../../../core/services/localization.service';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';
import { PermissionService } from '../../../../core/services/permission.service';
import { MarkPresentDialogService } from '../../../../shared/components/mark-present-dialog/mark-present-dialog.service';

@Component({
  selector: 'app-time-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiLoaderComponent, OrgDateOnlyPipe],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class TimeOverviewComponent implements OnInit {
  private readonly svc            = inject(TimeManagementService);
  private readonly attendanceSvc  = inject(AttendanceStateService);
  private readonly appState       = inject(AppStateService);
  private readonly loc            = inject(LocalizationService);
  private readonly permissions    = inject(PermissionService);
  private readonly markPresentDialog = inject(MarkPresentDialogService);

  /** attendance permission level >= 2, or admin. */
  readonly canMarkPresent = computed(() => this.permissions.can('attendance', 2));
  markPresentBusy = signal(false);
  selectedUserIds = signal<Set<string>>(new Set());

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
    return this.loc.formatTime(t);
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUserIds().has(userId);
  }

  toggleUserSelected(userId: string): void {
    this.selectedUserIds.update(set => {
      const next = new Set(set);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  clearSelection(): void {
    this.selectedUserIds.set(new Set());
  }

  async markPresentSelected(): Promise<void> {
    const ids = this.selectedUserIds();
    const items = this.absentEmployees().filter(e => ids.has(e.userId));
    if (!items.length || this.markPresentBusy()) return;

    this.markPresentBusy.set(true);
    try {
      const results = await this.markPresentDialog.open({
        items: items.map(e => ({
          userId: e.userId,
          userName: e.fullName,
          date: e.today?.date || this.loc.todayDateStr(),
        })),
      });
      if (!results) return;

      const succeededIds = new Set(results.filter(r => r.success).map(r => r.userId));
      if (succeededIds.size) this._loadTeam();
      // Keep failures selected so they're easy to retry.
      this.selectedUserIds.set(new Set([...ids].filter(id => !succeededIds.has(id))));
    } finally {
      this.markPresentBusy.set(false);
    }
  }

  trackById(_: number, item: TeamAttendanceItem): string {
    return item.userId;
  }
}
