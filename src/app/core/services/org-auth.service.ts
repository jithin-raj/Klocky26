import { Injectable, inject } from '@angular/core';
import { HttpContext }        from '@angular/common/http';
import { Observable, tap }    from 'rxjs';
import { ApiService }         from './api.service';
import { AppStateService }    from './app-state.service';
import { AUTH_SCOPE }         from '../http/auth-scope.context';
import { ApiResponse }        from '../models/api-response.model';
import { ChangePasswordRequest } from '../models/user.model';
import {
  SendOtpRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
  RegisterOrgRequest,
  OrgLoginResponse,
  ValidateSlugResponse,
  ValidateUrlNameResponse,
  RegisterCompleteRequest,
  TenantOptionsResponse,
  OrgLoginRequest,
  OrgDetails,
  UpdateOrgDetailsRequest,
} from '../models/org-auth.model';

// ─────────────────────────────────────────────────────────────────────────────
// OrgAuthService — org registration (§1) + org-admin step-up auth (§2)
//
// Registration (sendOtp/verifyOtp/registerOrg/validateSlug/getTenantOptions)
// is public — no token needed. orgLogin obtains the org-admin step-up token;
// everything after that (getOrgDetails/updateOrgDetails/changeOrgPassword/
// registerComplete) requires it, sent via AUTH_SCOPE 'org' so it never
// collides with the employee token a user might also be holding.
// ─────────────────────────────────────────────────────────────────────────────

const ORG_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'org') };

@Injectable({ providedIn: 'root' })
export class OrgAuthService {

  private readonly api      = inject(ApiService);
  private readonly appState = inject(AppStateService);

  // ── Registration (public) ───────────────────────────────────────────────

  /** POST /api/org/register/send-otp */
  sendOtp(payload: SendOtpRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/org/register/send-otp', payload);
  }

  /** POST /api/org/register/verify-otp */
  verifyOtp(payload: VerifyOtpRequest): Observable<ApiResponse<VerifyOtpResponse>> {
    return this.api.post<ApiResponse<VerifyOtpResponse>>('/org/register/verify-otp', payload);
  }

  /** POST /api/org/auth/register — creates the org + tenant DB, returns an org-admin token. */
  registerOrg(payload: RegisterOrgRequest): Observable<ApiResponse<OrgLoginResponse>> {
    return this.api.post<ApiResponse<OrgLoginResponse>>('/org/auth/register', payload).pipe(
      tap((res) => this.appState.setOrgAdminSession(res.data)),
    );
  }

  /** GET /api/org/auth/validate-slug/{slug} — superseded by validateUrlName() for routing; kept for the login-code lookup case. */
  validateSlug(slug: string): Observable<ApiResponse<ValidateSlugResponse>> {
    return this.api.get<ApiResponse<ValidateSlugResponse>>(`/org/auth/validate-slug/${slug}`);
  }

  /**
   * GET /api/org/auth/validate-url-name/{urlName} — ORG_URL_NAME_INTEGRATION.md
   * §2. Default AUTH_SCOPE ('user') means this naturally behaves as the spec
   * describes: called pre-login (no token yet) it's the anonymous case
   * (`tokenVerified: null`); called post-login the interceptor attaches the
   * employee bearer token automatically, making it the authenticated case
   * (`tokenVerified: true`, or a 403 if the token's org doesn't own this
   * urlName — treat a 403 exactly like a 404).
   */
  validateUrlName(urlName: string): Observable<ApiResponse<ValidateUrlNameResponse>> {
    return this.api.get<ApiResponse<ValidateUrlNameResponse>>(`/org/auth/validate-url-name/${urlName}`);
  }

  /** GET /api/tenant/options — dropdown lists for the registration form, cache after first call. */
  getTenantOptions(): Observable<ApiResponse<TenantOptionsResponse>> {
    return this.api.get<ApiResponse<TenantOptionsResponse>>('/tenant/options');
  }

  // ── Org-admin step-up (requires AUTH_SCOPE 'org') ───────────────────────

  /** POST /api/org/auth/login — obtains the org-admin step-up token. */
  orgLogin(payload: OrgLoginRequest): Observable<ApiResponse<OrgLoginResponse>> {
    return this.api.post<ApiResponse<OrgLoginResponse>>('/org/auth/login', payload).pipe(
      tap((res) => this.appState.setOrgAdminSession(res.data)),
    );
  }

  /** GET /api/org/auth/details */
  getOrgDetails(): Observable<ApiResponse<OrgDetails>> {
    return this.api.get<ApiResponse<OrgDetails>>('/org/auth/details', undefined, ORG_SCOPE);
  }

  /** PUT /api/org/auth/details */
  updateOrgDetails(payload: UpdateOrgDetailsRequest): Observable<ApiResponse<OrgDetails>> {
    return this.api.put<ApiResponse<OrgDetails>>('/org/auth/details', payload, ORG_SCOPE);
  }

  /** POST /api/org/auth/change-password — changes the org-admin login password. */
  changeOrgPassword(payload: ChangePasswordRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/org/auth/change-password', payload, ORG_SCOPE);
  }

  /** PUT /api/tenant/register-complete — org-wide attendance/policy defaults. */
  registerComplete(payload: RegisterCompleteRequest): Observable<ApiResponse<null>> {
    return this.api.put<ApiResponse<null>>('/tenant/register-complete', payload, ORG_SCOPE);
  }
}
