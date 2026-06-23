import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  AssignDesignationRequest,
  CreateDesignationRequest,
  Designation,
} from '../models/designation.model';

// ─────────────────────────────────────────────────────────────────────────────
// DesignationService — Designations CRUD, INTEGRATION_GUIDE.md §7.3
//
// Regular employee-token endpoints gated by permission level (create ≥2,
// delete =3) — not org-admin-scoped, so no AUTH_SCOPE context is needed; the
// interceptor attaches the default employee bearer token automatically.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DesignationService {

  private readonly api = inject(ApiService);

  /** GET /api/designations */
  getAll(): Observable<ApiResponse<Designation[]>> {
    return this.api.get<ApiResponse<Designation[]>>('/designations');
  }

  /** POST /api/designations */
  create(payload: CreateDesignationRequest): Observable<ApiResponse<Designation>> {
    return this.api.post<ApiResponse<Designation>>('/designations', payload);
  }

  /** DELETE /api/designations/{id} */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/designations/${id}`);
  }

  /** POST /api/designations/assign */
  assignToEmployee(payload: AssignDesignationRequest): Observable<ApiResponse<null>> {
    return this.api.post<ApiResponse<null>>('/designations/assign', payload);
  }
}
