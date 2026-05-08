import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { UiToastContainerComponent, UiModalOutletComponent } from '../../shared/components';
import { Subscription, filter } from 'rxjs';
import { OrgThemeService } from '../../core/services/org-theme.service';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'klocky-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, UiToastContainerComponent, UiModalOutletComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  isSidebarOpen = false;
  private _routerSub?: Subscription;

  // Computed organization name from the org slug
  orgName = computed(() => {
    const slug = this.appState.orgSlug();
    if (!slug) return '';
    // Convert slug to display name (e.g., 'acme-corp' -> 'Acme Corp')
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
    private appState: AppStateService
  ) {}

  ngOnInit() {
    // Restore org theme from previous session so accent/colors are correct on reload
    this.orgTheme.restoreFromStorage();

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