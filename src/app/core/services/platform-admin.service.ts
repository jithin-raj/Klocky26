import { Injectable, inject } from '@angular/core';
import { HttpContext, HttpResponse } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { ApiService }         from './api.service';
import { PlatformAdminStateService } from './platform-admin-state.service';
import { AUTH_SCOPE }         from '../http/auth-scope.context';
import { ApiResponse }        from '../models/api-response.model';
import {
  PlatformLoginRequest,
  PlatformLoginResponse,
  PlatformOrgListItem,
  CreatePlatformOrgRequest,
  CreatePlatformOrgResponse,
  UpdatePlatformOrgRequest,
  ResetOrgAdminPasswordResponse,
  SendOrgEmailRequest,
  DeleteOrgResult,
} from '../models/platform-auth.model';
import { ChangePasswordRequest } from '../models/user.model';

const PLATFORM_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'platform') };

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAdminService — POST /api/platform/auth/* (INTEGRATION_GUIDE.md §8)
// Klocky's own internal team — not customer-facing.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {

  private readonly api   = inject(ApiService);
  private readonly state = inject(PlatformAdminStateService);

  /** POST /api/platform/auth/login */
  login(payload: PlatformLoginRequest): Observable<ApiResponse<PlatformLoginResponse>> {
    return this.api.post<ApiResponse<PlatformLoginResponse>>('/platform/auth/login', payload).pipe(
      tap((res) => this.state.setSession(res.data)),
    );
  }

  /** POST /api/platform/auth/change-password */
  changePassword(payload: ChangePasswordRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/platform/auth/change-password', payload, PLATFORM_SCOPE);
  }

  // ── Organisations (§8) ──────────────────────────────────────────────────

  /** POST /api/platform/organisations — minimal-field creation, no OTP flow needed. */
  createOrganisation(payload: CreatePlatformOrgRequest): Observable<ApiResponse<CreatePlatformOrgResponse>> {
    return this.api.post<ApiResponse<CreatePlatformOrgResponse>>('/platform/organisations', payload, PLATFORM_SCOPE);
  }

  /** GET /api/platform/organisations — every org, all fields. */
  listOrganisations(): Observable<ApiResponse<PlatformOrgListItem[]>> {
    return this.api.get<ApiResponse<PlatformOrgListItem[]>>('/platform/organisations', undefined, PLATFORM_SCOPE);
  }

  /** GET /api/platform/organisations/{slug} — one org's detail (OrganizationSummaryResponse). */
  getOrganisation(slug: string): Observable<ApiResponse<PlatformOrgListItem>> {
    return this.api.get<ApiResponse<PlatformOrgListItem>>(`/platform/organisations/${slug}`, undefined, PLATFORM_SCOPE);
  }

  /** PUT /api/platform/organisations/{slug} — isActive toggles activate/deactivate. */
  updateOrganisation(slug: string, payload: UpdatePlatformOrgRequest): Observable<ApiResponse<PlatformOrgListItem>> {
    return this.api.put<ApiResponse<PlatformOrgListItem>>(`/platform/organisations/${slug}`, payload, PLATFORM_SCOPE);
  }

  /**
   * GET /api/platform/organisations/{slug}/backup — downloads a ZIP (one JSON
   * file per table + a README) as a binary blob, with the full response so the
   * caller can read the filename from Content-Disposition. Must run BEFORE the
   * delete — afterwards the tenant DB is gone. Errors: 404 unknown slug,
   * 401/403 without a platform-admin token.
   */
  backupOrganisation(slug: string): Observable<HttpResponse<Blob>> {
    return this.api.getBlobResponse(`/platform/organisations/${slug}/backup`, undefined, PLATFORM_SCOPE);
  }

  /**
   * DELETE /api/platform/organisations/{slug} — hard-deletes the org + tenant DB
   * + payments (irreversible). Unless `skipBackup` is true a backup is written
   * first and its path returned. 404 if the slug doesn't exist, 401/403 without
   * a platform-admin token. Tolerant of both the standard envelope and a flat
   * `{ message, backupPath }` body.
   */
  deleteOrganisation(slug: string, skipBackup = false): Observable<DeleteOrgResult> {
    return this.api
      .delete<ApiResponse<DeleteOrgResult> | DeleteOrgResult>(
        `/platform/organisations/${slug}?skipBackup=${skipBackup}`, PLATFORM_SCOPE,
      )
      .pipe(map((res) => ((res as ApiResponse<DeleteOrgResult>)?.data ?? res) as DeleteOrgResult));
  }

  /**
   * Klock-admin-only rename of an org's URL path segment — ORG_URL_NAME_INTEGRATION.md
   * §3. Org admins have no endpoint to change their own orgUrlName; this is
   * the only way it changes. 400 if format invalid, 409 if already taken.
   */
  renameOrgUrlName(orgSlug: string, newUrlName: string): Observable<ApiResponse<PlatformOrgListItem>> {
    return this.updateOrganisation(orgSlug, { orgUrlName: newUrlName });
  }

  /**
   * POST /api/platform/organisations/{slug}/reset-admin-password — issues a fresh
   * one-time temporary password for the org's admin (the real one is hashed and
   * can't be viewed). Live platform-admin endpoint.
   */
  resetOrgAdminPassword(slug: string): Observable<ApiResponse<ResetOrgAdminPasswordResponse>> {
    return this.api.post<ApiResponse<ResetOrgAdminPasswordResponse>>(`/platform/organisations/${slug}/reset-admin-password`, {}, PLATFORM_SCOPE);
  }

  /**
   * POST /api/platform/organisations/{slug}/send-email — REQUESTED, not
   * implemented server-side yet (SERVER_CHANGES_REQUEST.md §0d). Will 404
   * until that endpoint exists; callers should handle that explicitly rather
   * than showing a generic network error.
   */
  sendOrgEmail(slug: string, payload: SendOrgEmailRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>(`/platform/organisations/${slug}/send-email`, payload, PLATFORM_SCOPE);
  }

  logout(): void {
    this.state.clearSession();
  }
}
