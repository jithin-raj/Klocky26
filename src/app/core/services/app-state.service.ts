import { Injectable, inject, signal, computed } from '@angular/core';
import { CryptoService }              from './crypto.service';
import { AppState, DEFAULT_APP_STATE } from '../models/app-state.model';
import { EmployeeUser, LoginResponse, RefreshTokenResponse } from '../models/user.model';
import { OrgLoginResponse }            from '../models/org-auth.model';

// ─────────────────────────────────────────────────────────────────────────────
// AppStateService — Single encrypted global state
//
// Architecture:
//  • All auth/session data lives under ONE localStorage key (`klocky_s`)
//  • The blob is AES-256-GCM encrypted by CryptoService before storage
//  • Signals expose reactive slices to templates and services
//  • `init()` must be called via APP_INITIALIZER before the app renders
//
// Holds TWO independent tokens:
//  • accessToken/refreshToken  — the employee token (auth_type: "user"), used
//    for day-to-day work by everyone including admins.
//  • orgAdminToken             — a short-lived step-up token (auth_type: "org"),
//    obtained via org registration or POST /api/org/auth/login. Only used for
//    /api/org/auth/* and /api/tenant/register-complete. Never sent unless a
//    request explicitly opts into AUTH_SCOPE 'org'.
//
// Usage:
//   private appState = inject(AppStateService);
//   this.appState.user()            // current employee signal
//   this.appState.isAuthenticated() // computed boolean
//   await this.appState.setEmployeeSession(loginResponse);
//   await this.appState.clearState();
// ─────────────────────────────────────────────────────────────────────────────

/** Single localStorage key — short and opaque */
const STATE_KEY = 'klocky_s';

@Injectable({ providedIn: 'root' })
export class AppStateService {

  private readonly crypto = inject(CryptoService);

  // ── Internal full-state signal ────────────────────────────────────────────
  private readonly _state = signal<AppState>({ ...DEFAULT_APP_STATE });

  // ── Public reactive slices ────────────────────────────────────────────────

  /** Currently authenticated employee (null = logged out) */
  readonly user         = computed(() => this._state().user);

  /** Raw employee JWT access token */
  readonly accessToken  = computed(() => this._state().accessToken);

  /** Raw employee refresh token */
  readonly refreshToken = computed(() => this._state().refreshToken);

  /** Active org slug — the login code, NOT the URL segment. Use orgUrlName for routing. */
  readonly orgSlug      = computed(() => this._state().orgSlug);

  /** Active org's URL path segment — use this for all `:orgUrlName` routing. */
  readonly orgUrlName   = computed(() => this._state().orgUrlName);

  /** Raw org-admin step-up token */
  readonly orgAdminToken = computed(() => this._state().orgAdminToken);

  /** True when a non-expired employee access token is present */
  readonly isAuthenticated = computed(() => {
    const s = this._state();
    if (!s.accessToken) return false;
    if (s.expiresAt && Date.now() >= s.expiresAt) return false;
    return true;
  });

  /** True when a non-expired org-admin step-up token is present */
  readonly isOrgAdminAuthenticated = computed(() => {
    const s = this._state();
    if (!s.orgAdminToken) return false;
    if (s.orgAdminTokenExpiresAt && Date.now() >= s.orgAdminTokenExpiresAt) return false;
    return true;
  });

  /** Employee's role (convenience shorthand) */
  readonly userRole = computed(() => this._state().user?.role ?? null);

  /** Employee's permission level (1/2/3) — prefer this over role strings for write-gating */
  readonly permissionLevel = computed(() => this._state().user?.permissionLevel ?? null);

  // ── Initialisation (called by APP_INITIALIZER) ────────────────────────────

  /**
   * Loads and decrypts persisted state from localStorage.
   * Must be called at startup before any guard or service reads state.
   * Wired in `app.config.ts` via APP_INITIALIZER.
   */
  async init(): Promise<void> {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;

      const decrypted = await this.crypto.decrypt<AppState>(raw);
      if (decrypted) {
        this._state.set({ ...DEFAULT_APP_STATE, ...decrypted });
      } else {
        // Corrupt / tampered storage — wipe it
        localStorage.removeItem(STATE_KEY);
      }
    } catch {
      localStorage.removeItem(STATE_KEY);
    }
  }

  // ── Employee session ──────────────────────────────────────────────────────

  /**
   * Persists an employee login response into encrypted state.
   * Call immediately after POST /api/users/auth/login — the full profile
   * (`user`) isn't known yet, follow up with `updateUser()` from GET /me.
   */
  async setEmployeeSession(response: LoginResponse): Promise<void> {
    await this._persist({
      ...this._state(),
      accessToken:  response.accessToken,
      refreshToken: response.refreshToken,
      orgSlug:      response.orgSlug,
      orgUrlName:   response.orgUrlName,
      expiresAt:    new Date(response.expiresAt).getTime(),
    });
  }

  /** Updates both tokens after POST /api/users/auth/refresh. */
  async refreshEmployeeSession(response: RefreshTokenResponse): Promise<void> {
    await this._persist({
      ...this._state(),
      accessToken:  response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt:    new Date(response.accessTokenExpiresAt).getTime(),
    });
  }

  /** Stores the hydrated profile from GET /api/users/auth/me (also used after PUT /me). */
  async updateUser(user: EmployeeUser): Promise<void> {
    await this._persist({ ...this._state(), user, orgUrlName: user.orgUrlName });
  }

  // ── Org-admin step-up session ─────────────────────────────────────────────

  /** Stores the org-admin token from registration (1.3) or org-admin login (2.1). */
  async setOrgAdminSession(response: OrgLoginResponse): Promise<void> {
    await this._persist({
      ...this._state(),
      orgAdminToken:           response.accessToken,
      orgAdminTokenExpiresAt:  new Date(response.expiresAt).getTime(),
      // Registration only: no employee session exists yet, but the org slug/urlName are known.
      orgSlug:    this._state().orgSlug ?? response.orgSlug,
      orgUrlName: this._state().orgUrlName ?? response.orgUrlName,
    });
  }

  /** Drops the org-admin step-up token only — employee session is untouched. */
  async clearOrgAdminSession(): Promise<void> {
    await this._persist({
      ...this._state(),
      orgAdminToken: null,
      orgAdminTokenExpiresAt: null,
    });
  }

  /**
   * Merges an arbitrary partial state patch and persists.
   * Prefer the typed helpers above over this.
   */
  async patch(partial: Partial<AppState>): Promise<void> {
    await this._persist({ ...this._state(), ...partial });
  }

  /**
   * Clears all state (employee + org-admin) and removes the localStorage entry.
   * Call on logout.
   */
  async clearState(): Promise<void> {
    this._state.set({ ...DEFAULT_APP_STATE });
    try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
  }

  // ── Convenience getters (sync — for interceptors / guards) ────────────────

  /** Sync employee access token read — use when async is not possible (e.g. interceptors) */
  getAccessTokenSync(): string | null {
    return this._state().accessToken;
  }

  /** Sync org-admin token read — use when async is not possible (e.g. interceptors) */
  getOrgAdminTokenSync(): string | null {
    return this._state().orgAdminToken;
  }

  /** Returns true if the current employee access token is expired */
  isTokenExpired(): boolean {
    const { expiresAt } = this._state();
    if (!expiresAt) return true;
    return Date.now() >= expiresAt;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _persist(state: AppState): Promise<void> {
    this._state.set(state);
    try {
      const encrypted = await this.crypto.encrypt(state);
      localStorage.setItem(STATE_KEY, encrypted);
    } catch {
      // Crypto failure (e.g. private mode, quota exceeded) — keep in-memory state only
    }
  }
}
