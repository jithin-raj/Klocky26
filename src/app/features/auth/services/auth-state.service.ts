import { Injectable, signal, computed } from '@angular/core';
import { Title } from '@angular/platform-browser';

export type AuthStep = 'org' | 'email' | 'otp';
export type RegisterStep = 'org-info' | 'admin-email' | 'otp' | 'profile';
export type UserRole = 'admin' | 'employee';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  // ── Login flow ──────────────────────────────────────────────
  /** The org's URL path segment (orgUrlName) — short, no suffix. Used for display/routing, NOT the login API call. */
  readonly orgIdentifier = signal('globex');
  readonly orgDisplayName = signal('');
  /** The real backend login code (orgSlug, ".klock"-suffixed) — only used in POST /api/users/auth/login's body. */
  readonly orgSlugForLogin = signal('');
  readonly email = signal('');
  readonly userRole = signal<UserRole>('employee');

  // ── Register flow ───────────────────────────────────────────
  readonly regOrgName = signal('');
  readonly regOrgSlug = signal('');
  readonly regAdminEmail = signal('');
  readonly regAdminName = signal('');

  // ── Derived ─────────────────────────────────────────────────
  readonly orgDomain = computed(() =>
    this.orgIdentifier().toLowerCase().replace(/\s+/g, '') || ''
  );

  constructor(private titleService: Title) {}

  /**
   * @param urlName     orgUrlName — what's shown/used in the route
   * @param displayName Human-facing company name
   * @param orgSlug     Real login code (".klock"-suffixed) — only needed before
   *                    an employee login call; omit when not yet known (e.g.
   *                    mid-registration, before the org even exists).
   */
  setOrg(urlName: string, displayName?: string, orgSlug?: string): void {
    this.orgIdentifier.set(urlName);
    const name = displayName ?? (urlName.charAt(0).toUpperCase() + urlName.slice(1));
    this.orgDisplayName.set(name);
    this.titleService.setTitle(`${name}.klock`);
    if (orgSlug) this.orgSlugForLogin.set(orgSlug);
  }

  setEmail(email: string): void {
    this.email.set(email);
  }

  resetLogin(): void {
    this.orgIdentifier.set('');
    this.orgDisplayName.set('');
    this.orgSlugForLogin.set('');
    this.email.set('');
    this.titleService.setTitle('Klock');
  }

  resetToOrgStep(): void {
    this.email.set('');
    this.orgIdentifier.set('');
    this.orgDisplayName.set('');
    this.orgSlugForLogin.set('');
    this.titleService.setTitle('Klock');
  }
}
