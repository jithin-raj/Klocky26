import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AppStateService } from './app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// OrgNavigationService — org-aware navigation helper
//
// Provides helper methods to navigate within the org-scoped routes,
// automatically prefixing paths with the current org's URL name (NOT its
// login slug — see ORG_URL_NAME_INTEGRATION.md).
//
// Usage:
//   private orgNav = inject(OrgNavigationService);
//
//   // Navigate to /claysis/app/employees
//   this.orgNav.navigate(['app', 'employees']);
//
//   // Navigate to /claysis/app/employees/123
//   this.orgNav.navigate(['app', 'employees', '123']);
//
//   // Get org-scoped URL
//   const url = this.orgNav.getOrgUrl(['app', 'dashboard']);
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OrgNavigationService {
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);

  /**
   * Navigate to an org-scoped path
   * @param path - Route segments (without the org urlName)
   * @example navigate(['app', 'dashboard']) → navigates to /claysis/app/dashboard
   */
  navigate(path: string[]): Promise<boolean> {
    const orgUrlName = this.appState.orgUrlName() || 'default';
    return this.router.navigate([orgUrlName, ...path]);
  }

  /**
   * Navigate to an org-scoped path with query params
   * @param path - Route segments (without the org urlName)
   * @param queryParams - Query parameters object
   */
  navigateWithParams(path: string[], queryParams: Record<string, any>): Promise<boolean> {
    const orgUrlName = this.appState.orgUrlName() || 'default';
    return this.router.navigate([orgUrlName, ...path], { queryParams });
  }

  /**
   * Get org-scoped URL as string
   * @param path - Route segments (without the org urlName)
   * @returns Full path with the org urlName prefix
   * @example getOrgUrl(['app', 'dashboard']) → '/claysis/app/dashboard'
   */
  getOrgUrl(path: string[]): string {
    const orgUrlName = this.appState.orgUrlName() || 'default';
    return `/${orgUrlName}/${path.join('/')}`;
  }

  /**
   * Get current org urlName from URL or app state
   * @returns Current org's URL path segment
   */
  getCurrentOrgSlug(): string {
    return this.appState.orgUrlName() || 'default';
  }

  /**
   * Extract org urlName from current route
   * @param route - Activated route
   * @returns Org urlName from route params or null
   */
  getOrgSlugFromRoute(route: ActivatedRoute): string | null {
    let currentRoute = route;
    while (currentRoute) {
      const orgUrlName = currentRoute.snapshot.paramMap.get('orgUrlName');
      if (orgUrlName) {
        return orgUrlName;
      }
      if (currentRoute.parent) {
        currentRoute = currentRoute.parent;
      } else {
        break;
      }
    }
    return null;
  }
}
