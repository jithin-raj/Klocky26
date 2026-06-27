import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { UiModalOutletComponent } from '../../shared/components';
import { Subscription, filter } from 'rxjs';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';
import { PermissionService } from '../../core/services/permission.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AttendanceStateService } from '../../core/services/attendance-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'klocky-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, UiModalOutletComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  isSidebarOpen = false;
  private _routerSub?: Subscription;

  /** True while any HTTP request is in flight — drives the global top loading bar. */
  readonly isApiLoading = computed(() => this.loading.isLoading());

  // Human-facing org name — prefer the real displayName from GET /me (§3.3).
  // Only fall back to guessing one from the URL slug before /me has loaded
  // (e.g. first paint right after redirecting in from login).
  orgName = computed(() => {
    const user = this.appState.user();
    if (user?.displayName) return user.displayName;

    const slug = this.appState.orgUrlName();
    if (!slug) return '';
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Joint-venture branding — populated when an org is active.
  orgLogoUrl = '';

  get orgAccentColor(): string {
    return this.orgTheme.current.accent;
  }

  constructor(
    private router: Router,
    private orgTheme: OrgThemeService,
    private appState: AppStateService,
    private permissions: PermissionService,
    private realtime: RealtimeService,
    private attendance: AttendanceStateService,
    private notifications: NotificationService,
    private loading: LoadingService,
  ) {}

  ngOnInit() {
    // Restore org theme from previous session so accent/colors are correct on reload
    this.orgTheme.restoreFromStorage();

    // A full page reload kills the SignalR socket — reconnect using the
    // still-valid persisted access token.
    this.realtime.connect();

    // Source of truth for "am I currently clocked in" — SignalR keeps it live after this.
    this.attendance.refreshToday();

    // Load the notification list for the bell; live ones arrive via SignalR.
    this.notifications.load();

    // On a hard refresh / deep link the login flow's load() never ran — resolve
    // the permission map so the sidebar and *hasPermission gating are correct.
    if (!this.permissions.loaded()) {
      this.permissions.load().subscribe({ error: () => { /* guard re-loads on demand */ } });
    }

    this._routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => { this.isSidebarOpen = false; });
  }

  ngOnDestroy() {
    this._routerSub?.unsubscribe();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }
}