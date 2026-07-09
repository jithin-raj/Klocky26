import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AUTH_SCOPE } from '../http/auth-scope.context';
import { ApiResponse } from '../models/api-response.model';
import { OptionAdmin, CreateOptionRequest, UpdateOptionRequest } from '../models/options.model';

// ─────────────────────────────────────────────────────────────────────────────
// PlatformOptionsService — Klock-admin CRUD over the shared options catalogue.
// Platform-scoped. Edits are live for registration + org settings on next load.
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'platform') };

@Injectable({ providedIn: 'root' })
export class PlatformOptionsService {
  private readonly api = inject(ApiService);

  /** GET /api/platform/options/categories — the category list. */
  getCategories(): Observable<string[]> {
    return this.api.get<ApiResponse<string[]>>('/platform/options/categories', undefined, PLATFORM_SCOPE)
      .pipe(map(res => res.data ?? []));
  }

  /** GET /api/platform/options?category=&includeInactive=true */
  list(category: string, includeInactive = true): Observable<OptionAdmin[]> {
    return this.api.get<ApiResponse<OptionAdmin[]>>(
      '/platform/options', { category, includeInactive }, PLATFORM_SCOPE,
    ).pipe(map(res => res.data ?? []));
  }

  create(body: CreateOptionRequest): Observable<OptionAdmin> {
    return this.api.post<ApiResponse<OptionAdmin>>('/platform/options', body, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  /** code/category are immutable — only label/extra/sortOrder/isActive are editable. */
  update(id: string, body: UpdateOptionRequest): Observable<OptionAdmin> {
    return this.api.put<ApiResponse<OptionAdmin>>(`/platform/options/${id}`, body, PLATFORM_SCOPE)
      .pipe(map(res => res.data));
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/platform/options/${id}`, PLATFORM_SCOPE);
  }
}
