import { inject }          from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of }  from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppStateService } from '../services/app-state.service';
import { OrgAuthService }  from '../services/org-auth.service';
import { isValidOrgUrlNameFormat } from '../utils/org-slug.util';

// ─────────────────────────────────────────────────────────────────────────────
// AuthGuard — protects routes that require a logged-in user
//
// Apply to any route that needs authentication:
//   { path: ':orgUrlName/app', component: ShellComponent, canActivate: [authGuard], ... }
//
// Validates:
//  1. User is authenticated
//  2. The :orgUrlName route param has a valid format (cheap, no network call)
//  3. GET /api/org/auth/validate-url-name/{urlName} (ORG_URL_NAME_INTEGRATION.md
//     §2) — called with the employee bearer token already attached (default
//     AUTH_SCOPE), so the server confirms the TOKEN's own org actually owns
//     this urlName, not just that the urlName exists. This is the real
//     security boundary SERVER_CHANGES_REQUEST.md §1 asked for — a forged or
//     stale urlName in the URL now fails server-side, not via a client-only
//     cache comparison.
//
// A 403 from that endpoint means "token doesn't belong to this org" — treated
// exactly like a 404 (don't leak "this org exists but isn't yours").
// Any other error (network blip, 5xx, cold start) fails OPEN rather than
// kicking out an otherwise-valid session — a previous version of this guard
// hard-failed on any error from a similar check and that turned out to be
// too fragile in practice.
//
// Redirects:
//  - Unauthenticated users → /login with returnUrl
//  - Wrong/invalid org urlName → /404 (unauthorized access to different organization)
// ─────────────────────────────────────────────────────────────────────────────

export const authGuard: CanActivateFn = (route, state): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const appState = inject(AppStateService);
  const orgAuth  = inject(OrgAuthService);
  const router   = inject(Router);

  if (!appState.isAuthenticated()) {
    // Not authenticated - redirect to login with return URL
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const urlOrgUrlName = route.paramMap.get('orgUrlName') || route.parent?.paramMap.get('orgUrlName');

  // Format check first — rejects garbage/manually-edited URLs immediately,
  // no network round-trip needed for input that can't possibly be a real urlName.
  if (!urlOrgUrlName || !isValidOrgUrlNameFormat(urlOrgUrlName)) {
    return router.createUrlTree(['/404']);
  }

  return orgAuth.validateUrlName(urlOrgUrlName).pipe(
    map((res) => res.data.isValid && res.data.tokenVerified !== false ? true : router.createUrlTree(['/404'])),
    catchError((err) => {
      // 403 = token doesn't belong to this org; 404 = urlName doesn't exist.
      // Both are definitive — anything else (network/5xx/cold-start) fails open.
      if (err?.status === 403 || err?.status === 404) return of(router.createUrlTree(['/404']));
      return of(true);
    }),
  );
};
