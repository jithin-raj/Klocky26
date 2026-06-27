import { Component, EventEmitter, Input, Output, OnDestroy, ChangeDetectionStrategy, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconSearchComponent } from '../../shared/icons';
import { UiIconComponent, UiIconName } from '../../shared/components';
import { AppBrandComponent } from '../../shared/components/app-brand/app-brand.component';
import { AttendanceStateService } from '../../core/services/attendance-state.service';
import { AppStateService } from '../../core/services/app-state.service';
import { UserAuthService } from '../../core/services/user-auth.service';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification, NotificationType } from '../../core/models/notification.model';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'klocky-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconSearchComponent, UiIconComponent, AppBrandComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() orgName = '';
  @Input() orgLogoUrl = '';
  @Input() orgAccentColor = '';

  readonly attendance = inject(AttendanceStateService);
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);
  private readonly userAuth = inject(UserAuthService);
  private readonly orgTheme = inject(OrgThemeService);

  // Expose signals as shorthand aliases for the template
  get isClockedIn()  { return this.attendance.isClockedIn; }
  get geoStatus()    { return this.attendance.geoStatus; }
  get geoToast()     { return this.attendance.geoToast; }

  /** Pending geo confirmation — true after location is found, before user confirms */
  geoConfirmPending = signal(false);
  private _pendingPosition: GeolocationPosition | null = null;

  /** Admins manage the org, they don't punch in/out — hide the clock widget for them. */
  readonly isAdmin = computed(() => !!this.appState.user()?.isAdmin);

  get isJv(): boolean { return !!this.orgName; }
  get accentColor(): string {
    return this.isJv && this.orgAccentColor ? this.orgAccentColor : '#6366f1';
  }

  // ── Org-scoped routing ───────────────────────────────────────────
  private orgPrefix = computed(() => `/${this.appState.orgUrlName() || 'default'}`);

  // ── Logged-in user (profile menu) ────────────────────────────────
  readonly user = computed(() => this.appState.user());
  readonly fullName = computed(() => this.user()?.fullName?.trim() || 'My Account');
  readonly email = computed(() => this.user()?.email ?? '');
  readonly avatarUrl = computed(() => this.user()?.avatarUrl || '');
  readonly roleLabel = computed(() => this._roleLabel(this.user()?.role));
  readonly initials = computed(() => {
    const u = this.user();
    const a = (u?.firstName?.[0] ?? '') + (u?.lastName?.[0] ?? '');
    return (a || u?.fullName?.[0] || u?.email?.[0] || 'U').toUpperCase();
  });
  readonly showSettings = computed(() => {
    const role = this.user()?.role;
    return role === 'admin' || role === 'hr' || role === 'super_admin';
  });

  // ── Dropdown open state ──────────────────────────────────────────
  notifOpen = signal(false);
  profileOpen = signal(false);

  toggleNotif(event: Event): void {
    event.stopPropagation();
    this.profileOpen.set(false);
    this.notifOpen.update(v => !v);
  }
  toggleProfile(event: Event): void {
    event.stopPropagation();
    this.notifOpen.set(false);
    this.profileOpen.update(v => !v);
  }
  /** Any click outside the menus closes them. */
  @HostListener('document:click')
  closeMenus(): void {
    this.notifOpen.set(false);
    this.profileOpen.set(false);
  }
  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeMenus(); }

  // ── Notifications ────────────────────────────────────────────────
  readonly unreadCount = computed(() => this.notifications.unreadCount());
  readonly recentNotifs = computed(() => this.notifications.recent());

  openNotification(n: AppNotification): void {
    this.notifications.markRead(n.id);
    this.notifOpen.set(false);
    if (n.link) {
      this.router.navigateByUrl(n.link);
    } else {
      this.viewAllNotifications();
    }
  }
  markAllRead(event: Event): void {
    event.stopPropagation();
    this.notifications.markAllRead();
  }
  viewAllNotifications(): void {
    this.notifOpen.set(false);
    this.router.navigate([this.orgPrefix(), 'app', 'notifications']);
  }

  notifIcon(type: NotificationType): UiIconName {
    const map: Record<NotificationType, UiIconName> = {
      info: 'bell', success: 'check-circle', warning: 'bell-dot',
      attendance: 'clock', leave: 'calendar', announcement: 'megaphone', system: 'settings',
    };
    return map[type] ?? 'bell';
  }
  notifColor(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      info: '#6366f1', success: '#10b981', warning: '#f59e0b',
      attendance: '#0ea5e9', leave: '#8b5cf6', announcement: '#ec4899', system: '#64748b',
    };
    return map[type] ?? '#6366f1';
  }

  /** Compact "2m / 3h / 5d / date" relative label. */
  timeAgo(iso: string): string {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── Profile menu actions ─────────────────────────────────────────
  goToProfile(): void {
    this.profileOpen.set(false);
    this.router.navigate([this.orgPrefix(), 'app', 'profile']);
  }
  goToSettings(): void {
    this.profileOpen.set(false);
    this.router.navigate([this.orgPrefix(), 'app', 'settings', 'org-profile']);
  }
  async logout(): Promise<void> {
    this.profileOpen.set(false);
    await this.userAuth.logout();
    this.notifications.clear();
    this.orgTheme.reset();
    this.router.navigate(['/']);
  }

  private _roleLabel(role?: UserRole | null): string {
    if (!role) return '';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
      this._pendingPosition = null;
      this.geoConfirmPending.set(true);
      this.attendance.showToast('📍 Geo not available — confirm manual clock-in.', 'info');
      return;
    }
    this.attendance.geoStatus.set('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._pendingPosition = pos;
        this.attendance.geoStatus.set('idle'); // reset until confirmed
        this.geoConfirmPending.set(true);
      },
      () => {
        this._pendingPosition = null;
        this.attendance.geoStatus.set('idle');
        this.geoConfirmPending.set(true);
        this.attendance.showToast('📍 Location unavailable — confirm manual clock-in.', 'warn');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  confirmGeoClockIn() {
    this.geoConfirmPending.set(false);
    const pos = this._pendingPosition;
    this.attendance.clockIn('mobile', pos ? {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    } : {});
    this._pendingPosition = null;
  }

  cancelGeoClockIn() {
    this.geoConfirmPending.set(false);
    this._pendingPosition = null;
    this.attendance.geoStatus.set('idle');
    this.attendance.showToast('Clock-in cancelled.', 'info');
  }

  navigateToDashboard() {
    const orgUrlName = this.appState.orgUrlName();
    const dashboardRoute = `/${orgUrlName}/app/dashboard`;
    this.router.navigate([dashboardRoute]);
  }

  ngOnDestroy() { /* service manages its own lifecycle */ }
}
