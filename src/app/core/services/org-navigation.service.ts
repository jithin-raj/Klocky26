import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AppStateService } from './app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// OrgNavigationService — org-aware navigation helper
//
// Provides helper methods to navigate within the org-scoped routes,
// automatically prefixing paths with the current organization slug.
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
   * @param path - Route segments (without org slug)
   * @example navigate(['app', 'dashboard']) → navigates to /claysis/app/dashboard
   */
  navigate(path: string[]): Promise<boolean> {
    const orgSlug = this.appState.orgSlug() || 'default';
    return this.router.navigate([orgSlug, ...path]);
  }

  /**
   * Navigate to an org-scoped path with query params
   * @param path - Route segments (without org slug)
   * @param queryParams - Query parameters object
   */
  navigateWithParams(path: string[], queryParams: Record<string, any>): Promise<boolean> {
    const orgSlug = this.appState.orgSlug() || 'default';
    return this.router.navigate([orgSlug, ...path], { queryParams });
  }

  /**
   * Get org-scoped URL as string
   * @param path - Route segments (without org slug)
   * @returns Full path with org slug prefix
   * @example getOrgUrl(['app', 'dashboard']) → '/claysis/app/dashboard'
   */
  getOrgUrl(path: string[]): string {
    const orgSlug = this.appState.orgSlug() || 'default';
    return `/${orgSlug}/${path.join('/')}`;
  }

  /**
   * Get current org slug from URL or app state
   * @returns Current organization slug
   */
  getCurrentOrgSlug(): string {
    return this.appState.orgSlug() || 'default';
  }

  /**
   * Extract org slug from current route
   * @param route - Activated route
   * @returns Org slug from route params or null
   */
  getOrgSlugFromRoute(route: ActivatedRoute): string | null {
    let currentRoute = route;
    while (currentRoute) {
      const orgSlug = currentRoute.snapshot.paramMap.get('orgSlug');
      if (orgSlug) {
        return orgSlug;
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
