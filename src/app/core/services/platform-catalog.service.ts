import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AUTH_SCOPE } from '../http/auth-scope.context';
import { ApiResponse } from '../models/api-response.model';
import {
  CatalogResponse, CatalogPlan, CatalogAddon, PlanUpsertRequest, AddonUpsertRequest,
} from '../models/platform-catalog.model';

// ─────────────────────────────────────────────────────────────────────────────
// PlatformCatalogService — Klock-admin CRUD over the plan/add-on catalogue.
// Platform-scoped bearer. Edits are live (GET /api/plans reads the same DB).
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'platform') };

@Injectable({ providedIn: 'root' })
export class PlatformCatalogService {
  private readonly api = inject(ApiService);

  /** GET /api/platform/catalog — plans + add-ons incl. inactive. */
  getCatalog(): Observable<CatalogResponse> {
    return this.api.get<ApiResponse<CatalogResponse>>('/platform/catalog', undefined, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  /**
   * POST /api/platform/catalog/sync-defaults — upsert every plan + add-on to the
   * shipped defaults (and deactivate retired ones). Fastest way to apply new
   * pricing after a deploy; GET /api/plans then reflects the new values.
   */
  syncDefaults(): Observable<CatalogResponse> {
    return this.api.post<ApiResponse<CatalogResponse>>('/platform/catalog/sync-defaults', {}, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  // ── Plans ──────────────────────────────────────────────────────────────────

  createPlan(body: PlanUpsertRequest): Observable<CatalogPlan> {
    return this.api.post<ApiResponse<CatalogPlan>>('/platform/catalog/plans', body, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  /**
   * `code` is immutable, but the server validates it as required on the body, so
   * we always send the path key back in the payload (same value — can't change).
   */
  updatePlan(code: string, body: PlanUpsertRequest): Observable<CatalogPlan> {
    return this.api.put<ApiResponse<CatalogPlan>>(`/platform/catalog/plans/${code}`, { ...body, code }, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  /** 409 if any org is on this plan — deactivate instead. */
  deletePlan(code: string): Observable<void> {
    return this.api.delete<void>(`/platform/catalog/plans/${code}`, PLATFORM_SCOPE);
  }

  // ── Add-ons ─────────────────────────────────────────────────────────────────

  createAddon(body: AddonUpsertRequest): Observable<CatalogAddon> {
    return this.api.post<ApiResponse<CatalogAddon>>('/platform/catalog/addons', body, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  /** Server validates `code` as required on the body — send the (immutable) path key back. */
  updateAddon(code: string, body: AddonUpsertRequest): Observable<CatalogAddon> {
    return this.api.put<ApiResponse<CatalogAddon>>(`/platform/catalog/addons/${code}`, { ...body, code }, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  deleteAddon(code: string): Observable<void> {
    return this.api.delete<void>(`/platform/catalog/addons/${code}`, PLATFORM_SCOPE);
  }
}
