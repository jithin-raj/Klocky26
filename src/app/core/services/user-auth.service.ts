import { Injectable, inject } from '@angular/core';
import { Observable, tap, firstValueFrom } from 'rxjs';
import { ApiService }         from './api.service';
import { AppStateService }    from './app-state.service';
import { PermissionService }  from './permission.service';
import { RealtimeService }    from './realtime.service';
import { MobileBridgeService } from './mobile-bridge.service';
import { ApiResponse }        from '../models/api-response.model';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  EmployeeUser,
  UpdateMeRequest,
  ChangePasswordRequest,
} from '../models/user.model';

// ─────────────────────────────────────────────────────────────────────────────
// UserAuthService — POST /api/users/auth/* (INTEGRATION_GUIDE.md §3)
//
// This is the ONE login screen for everyone — admins, HR, managers, regular
// employees. The org admin is also a row here (role: "admin"); the separate
// org-admin token (OrgAuthService) is only for org-settings step-up actions.
//
// Usage:
//   private userAuth = inject(UserAuthService);
//   this.userAuth.login({ orgSlug, email, password }).subscribe();
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UserAuthService {

  private readonly api      = inject(ApiService);
  private readonly appState = inject(AppStateService);
  private readonly permissions = inject(PermissionService);
  private readonly realtime = inject(RealtimeService);
  private readonly bridge   = inject(MobileBridgeService);

  /** POST /api/users/auth/login — persists tokens, does NOT fetch /me (call getMe() after). */
  login(payload: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/users/auth/login', payload).pipe(
      tap((res) => this.appState.setEmployeeSession(res.data)),
    );
  }

  /** POST /api/users/auth/refresh — called by the error interceptor on 401. */
  refreshToken(): Observable<ApiResponse<RefreshTokenResponse>> {
    const payload: RefreshTokenRequest = {
      orgSlug: this.appState.orgSlug() ?? '',
      refreshToken: this.appState.refreshToken() ?? '',
    };
    return this.api.post<ApiResponse<RefreshTokenResponse>>('/users/auth/refresh', payload).pipe(
      tap((res) => this.appState.refreshEmployeeSession(res.data)),
    );
  }

  /** GET /api/users/auth/me — call once after login (and after every refresh) to hydrate the shell. */
  getMe(): Observable<ApiResponse<EmployeeUser>> {
    return this.api.get<ApiResponse<EmployeeUser>>('/users/auth/me').pipe(
      tap((res) => this.appState.updateUser(res.data)),
    );
  }

  /** PUT /api/users/auth/me — self-service profile edit, returns the full /me payload again. */
  updateMe(payload: UpdateMeRequest): Observable<ApiResponse<EmployeeUser>> {
    return this.api.put<ApiResponse<EmployeeUser>>('/users/auth/me', payload).pipe(
      tap((res) => this.appState.updateUser(res.data)),
    );
  }

  /** POST /api/users/auth/change-password */
  changePassword(payload: ChangePasswordRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/users/auth/change-password', payload);
  }

  /**
   * Best-effort server logout (revokes the refresh token + clears the device's
   * FCM token), then clears the encrypted local session and disconnects the
   * realtime hub. The server call runs while the token is still present; any
   * failure (offline, endpoint absent) is ignored so logout always completes.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/users/auth/logout', {
        deviceId: this.bridge.deviceId ?? null,
        refreshToken: this.appState.refreshToken() ?? null,
      }));
    } catch { /* best-effort — proceed with local teardown regardless */ }

    this.realtime.disconnect();
    this.permissions.clear();
    await this.appState.clearState();
  }
}
