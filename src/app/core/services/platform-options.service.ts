import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AUTH_SCOPE } from '../http/auth-scope.context';
import { ApiResponse } from '../models/api-response.model';
import { asArray } from '../utils/api-list.util';
import { OptionAdmin, CreateOptionRequest, UpdateOptionRequest } from '../models/options.model';

// ─────────────────────────────────────────────────────────────────────────────
// PlatformOptionsService — Klock-admin CRUD over the shared options catalogue.
// Platform-scoped. Edits are live for registration + org settings on next load.
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_SCOPE = { context: new HttpContext().set(AUTH_SCOPE, 'platform') };

/**
 * Coerce the /categories payload to a plain string[]. The backend has returned
 * this several shapes: a bare string[], `{ data:[...] }`, `{ categories:[...] }`,
 * an array of `{ category|code|name }` objects, or a `Record<category, items[]>`
 * (same object as GET /api/options — the categories are then the keys). Anything
 * non-iterable here throws "newCollection[Symbol.iterator] is not a function" in
 * the template @for, so normalise defensively.
 */
function normalizeCategories(data: unknown): string[] {
  let arr: unknown[];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj['data'])) arr = obj['data'] as unknown[];
    else if (Array.isArray(obj['categories'])) arr = obj['categories'] as unknown[];
    else arr = Object.keys(obj);          // Record<category, items[]> → keys
  } else {
    arr = [];
  }
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        return String(o['category'] ?? o['code'] ?? o['name'] ?? o['value'] ?? '');
      }
      return String(item ?? '');
    })
    .filter((s) => !!s);
}

@Injectable({ providedIn: 'root' })
export class PlatformOptionsService {
  private readonly api = inject(ApiService);

  /** GET /api/platform/options/categories — the category list (shape-tolerant). */
  getCategories(): Observable<string[]> {
    return this.api.get<ApiResponse<unknown>>('/platform/options/categories', undefined, PLATFORM_SCOPE)
      .pipe(map(res => normalizeCategories(res?.data)));
  }

  /** GET /api/platform/options?category=&includeInactive=true */
  list(category: string, includeInactive = true): Observable<OptionAdmin[]> {
    return this.api.get<ApiResponse<OptionAdmin[]>>(
      '/platform/options', { category, includeInactive }, PLATFORM_SCOPE,
    ).pipe(map(res => asArray<OptionAdmin>(res.data)));
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
