import { Component, EventEmitter, Input, Output, OnDestroy, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconBellComponent, IconSearchComponent } from '../../shared/icons';
import { AppBrandComponent } from '../../shared/components/app-brand/app-brand.component';
import { AttendanceStateService } from '../../core/services/attendance-state.service';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'klocky-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconBellComponent, IconSearchComponent, AppBrandComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() orgName = '';
  @Input() orgLogoUrl = '';
  @Input() orgAccentColor = '';

  readonly attendance = inject(AttendanceStateService);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);

  // Expose signals as shorthand aliases for the template
  get isClockedIn()  { return this.attendance.isClockedIn; }
  get geoStatus()    { return this.attendance.geoStatus; }
  get geoToast()     { return this.attendance.geoToast; }

  /** Pending geo confirmation — true after location is found, before user confirms */
  geoConfirmPending = signal(false);
  private _pendingGeoId = '';

  get isJv(): boolean { return !!this.orgName; }
  get accentColor(): string {
    return this.isJv && this.orgAccentColor ? this.orgAccentColor : '#6366f1';
  }

  toggleClock() {
    if (this.attendance.isClockedIn()) {
      this.attendance.manualClockOut();
    } else {
      this._geoClockIn();
    }
  }

  private _geoClockIn() {
    if (!navigator.geolocation) {
      this.geoConfirmPending.set(true);
      this._pendingGeoId = 'MANUAL';
      this.attendance.showToast('📍 Geo not available — confirm manual clock-in.', 'info');
      return;
    }
    this.attendance.geoStatus.set('locating');

    navigator.geolocation.getCurrentPosition(
      (_pos) => {
        this._pendingGeoId = 'GEO-' + Date.now().toString(36).toUpperCase();
        this.attendance.geoStatus.set('idle'); // reset until confirmed
        this.geoConfirmPending.set(true);
      },
      () => {
        this._pendingGeoId = 'MANUAL';
        this.attendance.geoStatus.set('idle');
        this.geoConfirmPending.set(true);
        this.attendance.showToast('📍 Location unavailable — confirm manual clock-in.', 'warn');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  confirmGeoClockIn() {
    this.geoConfirmPending.set(false);
    this.attendance.clockIn(this._pendingGeoId);
    this._pendingGeoId = '';
  }

  cancelGeoClockIn() {
    this.geoConfirmPending.set(false);
    this._pendingGeoId = '';
    this.attendance.geoStatus.set('idle');
    this.attendance.showToast('Clock-in cancelled.', 'info');
  }

  navigateToDashboard() {
    const orgSlug = this.appState.orgSlug();
    const dashboardRoute = `/${orgSlug}/app/dashboard`;
    this.router.navigate([dashboardRoute]);
  }

  ngOnDestroy() { /* service manages its own lifecycle */ }
}
