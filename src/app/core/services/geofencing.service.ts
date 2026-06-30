import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { GeofenceScope, ScopeGeofence, SetGeofence } from '../models/geofencing.model';

// ─────────────────────────────────────────────────────────────────────────────
// GeofencingService — /api/geofencing
//
// Set/clear a fence at office, department or employee scope. To clear, send all
// three coordinate fields as null (the server rejects partial with 400).
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GeofencingService {

  private readonly api = inject(ApiService);

  /** GET /api/geofencing — all configured fences across scopes. */
  getAll(): Observable<ScopeGeofence[]> {
    return this.api.get<ApiResponse<ScopeGeofence[]>>('/geofencing')
      .pipe(map(res => res.data ?? []));
  }

  /** PUT /api/geofencing/{scope}/{id} — set (or clear, all-null) a fence. */
  set(scope: GeofenceScope, id: string, body: SetGeofence): Observable<ScopeGeofence> {
    return this.api.put<ApiResponse<ScopeGeofence>>(`/geofencing/${scope}/${id}`, body)
      .pipe(map(res => res.data));
  }
}
