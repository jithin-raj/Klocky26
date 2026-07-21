import { Component, OnInit, OnDestroy, computed, signal, inject, ElementRef, ViewChild } from '@angular/core';
import {
  RouterOutlet, Router, NavigationEnd, NavigationStart,
  NavigationCancel, NavigationError, NavigationSkipped,
} from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { UiModalOutletComponent, UiLoaderComponent } from '../../shared/components';
import { TrialBannerComponent } from '../trial-banner/trial-banner.component';
import { LegalConsentModalComponent } from '../../shared/components/legal-consent-modal/legal-consent-modal.component';
import { MarkPresentDialogComponent } from '../../shared/components/mark-present-dialog/mark-present-dialog.component';
import { DpdpConsentService } from '../../core/services/dpdp-consent.service';
import { AiService } from '../../core/services/ai.service';
import { Subscription, filter, take } from 'rxjs';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';
import { OrgLogoService } from '../../core/services/org-logo.service';
import { UserAuthService } from '../../core/services/user-auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AttendanceStateService } from '../../core/services/attendance-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoadingService } from '../../core/services/loading.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { MobileBridgeService } from '../../core/services/mobile-bridge.service';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'klocky-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, BottomNavComponent, UiModalOutletComponent, UiLoaderComponent, TrialBannerComponent, LegalConsentModalComponent, MarkPresentDialogComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  @ViewChild('contentEl', { static: true }) contentEl!: ElementRef<HTMLElement>;
  isSidebarOpen = false;
  private _routerSub?: Subscription;
  private _subFirstLoad?: Subscription;

  /** True while any HTTP request is in flight — drives the global top loading bar. */
  readonly isApiLoading = computed(() => this.loading.isLoading());

  /** True while the router is navigating (incl. lazy-loading a route chunk) —
      drives the centered page loader overlay. */
  readonly routeLoading = signal(false);

  /**
   * Dims the sidebar nav while the subscription is expired (cosmetic only —
   * subscriptionGuard is the real block). Backed by its own inject() field
   * (not the `subscription` constructor param below) so this initializer
   * doesn't depend on constructor-parameter assignment ordering.
   */
  private readonly subscriptionSvc = inject(SubscriptionService);
  readonly isExpired = this.subscriptionSvc.isExpiredNow;

  /** Sidebar "Tasks" badge — TaskService self-refreshes on notification.created too. */
  private readonly taskSvc = inject(TaskService);

  /** Legal-consent gate — LegalConsentModalComponent renders itself when this is true. */
  private readonly dpdpConsent = inject(DpdpConsentService);
  readonly needsLegalConsent = this.dpdpConsent.needsAcceptance;

  /** Loaded once here so the dedicated AI screen (app/ai) doesn't need its own fetch on mount. */
  private readonly ai = inject(AiService);

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

  // Org logo — prefer the URL stored on the user object (set by /me or after upload);
  // fall back to the anonymous public endpoint so the logo appears even on first load.
  get orgLogoUrl(): string {
    return this.appState.user()?.logoUrl
      || this.logoSvc.publicLogoUrl(this.appState.orgSlug() ?? '');
  }

  // Always the public anonymous endpoint — used as a secondary attempt if orgLogoUrl
  // fails to load (e.g. in the React Native WebView where CDN/signed URLs may be blocked).
  get orgLogoFallbackUrl(): string {
    return this.logoSvc.publicLogoUrl(this.appState.orgSlug() ?? '');
  }

  get orgAccentColor(): string {
    return this.orgTheme.current.accent;
  }

  private readonly logoSvc = inject(OrgLogoService);

  /**
   * The app-style bottom nav is for the real React-Native wrapper only
   * (window.__IS_MOBILE__) — a narrow *browser* window (including on a phone)
   * gets the same desktop sidebar layout, just responsively scaled, not the
   * native-app bottom-nav experience.
   */
  private readonly mobileBridge = inject(MobileBridgeService);
  readonly isMobile = this.mobileBridge.isMobile;

  constructor(
    private router: Router,
    private orgTheme: OrgThemeService,
    private appState: AppStateService,
    private userAuth: UserAuthService,
    private permissions: PermissionService,
    private realtime: RealtimeService,
    private attendance: AttendanceStateService,
    private notifications: NotificationService,
    private loading: LoadingService,
    private subscription: SubscriptionService,
  ) {}

  ngOnInit() {
    // Restore org theme from previous session so accent/colors are correct on reload
    this.orgTheme.restoreFromStorage();

    // Refresh user profile on every shell mount (reload / navigation into the app).
    // This picks up org color/logo changes made by an admin in another session
    // without requiring the user to log out and back in.
    if (this.appState.isAuthenticated()) {
      this.userAuth.getMe().subscribe({
        next: (res) => {
          if (res.data.accentColor) {
            const theme = this.orgTheme.generateThemeFromColor(res.data.accentColor);
            this.orgTheme.apply(theme);
          }
        },
        error: () => { /* non-fatal — stale theme stays active */ },
      });
    }

    // A full page reload kills the SignalR socket — reconnect using the
    // still-valid persisted access token.
    this.realtime.connect();

    // Source of truth for "am I currently clocked in" — SignalR keeps it live after this.
    this.attendance.refreshToday();

    // Load the notification list for the bell; live ones arrive via SignalR.
    this.notifications.load();

    // Sidebar "Tasks" badge — populated on every shell mount (login / hard refresh).
    this.taskSvc.refreshCounts();

    // Legal-consent gate — re-check on every shell mount (hard refresh / deep
    // link never goes through login()'s or refreshToken()'s own load() calls).
    this.dpdpConsent.load();

    // AI status — cached for the session once loaded; every report card/chat
    // widget mount reads AiService's signals instead of re-fetching.
    this.ai.loadStatus();

    // On a hard refresh / deep link the login flow's load() never ran — resolve
    // the permission map so the sidebar and *hasPermission gating are correct.
    if (!this.permissions.loaded()) {
      this.permissions.load().subscribe({ error: () => { /* guard re-loads on demand */ } });
    }

    // Subscription state — single source of truth for feature gating, usage bars
    // and the trial/expiry banner. Refreshed here on every shell mount so it's
    // current after login and hard refresh. If it comes back expired, bounce
    // admins to billing straight away (the 402 interceptor is the ongoing gate).
    this.subscription.load();
    this._subFirstLoad = this.subscription.state$
      .pipe(filter((s): s is NonNullable<typeof s> => !!s), take(1))
      .subscribe((s) => {
        if (!s.accessAllowed && !this.router.url.includes('/app/billing')) {
          this.router.navigate([this.appState.orgUrlName() || 'default', 'app', 'billing']);
        }
      });

    this._routerSub = this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        this.routeLoading.set(true);
      } else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError ||
        e instanceof NavigationSkipped
      ) {
        this.routeLoading.set(false);
        if (e instanceof NavigationEnd) {
          this.isSidebarOpen = false;
          this.contentEl?.nativeElement?.scrollTo({ top: 0, behavior: 'instant' });
        }
      }
    });
  }

  ngOnDestroy() {
    this._routerSub?.unsubscribe();
    this._subFirstLoad?.unsubscribe();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }
}