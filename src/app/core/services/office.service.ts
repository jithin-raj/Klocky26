import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { Office, OfficeRequest } from '../models/office.model';

// ─────────────────────────────────────────────────────────────────────────────
// OfficeService — Offices CRUD, INTEGRATION_GUIDE.md §7.1
//
// Regular employee-token endpoints gated by permission level (create/update
// ≥2, delete =3) — not org-admin-scoped, so no AUTH_SCOPE context is needed;
// the interceptor attaches the default employee bearer token automatically.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OfficeService {

  private readonly api = inject(ApiService);

  /** GET /api/offices */
  getAll(): Observable<ApiResponse<Office[]>> {
    return this.api.get<ApiResponse<Office[]>>('/offices');
  }

  /** POST /api/offices */
  create(payload: OfficeRequest): Observable<ApiResponse<Office>> {
    return this.api.post<ApiResponse<Office>>('/offices', payload);
  }

  /** PUT /api/offices/{id} */
  update(id: string, payload: OfficeRequest): Observable<ApiResponse<Office>> {
    return this.api.put<ApiResponse<Office>>(`/offices/${id}`, payload);
  }

  /** DELETE /api/offices/{id} — 409 if a department or employee still references it */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/offices/${id}`);
  }
}
