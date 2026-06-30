// ─────────────────────────────────────────────────────────────────────────────
// Geofencing — /api/geofencing (office / department / employee scopes)
//
// All three coordinate fields must be sent together (all set, or all null to
// clear). radiusMeters is always meters. Geofence may be set directly on a
// scope or inherited from an office (see `source`).
// ─────────────────────────────────────────────────────────────────────────────

export type GeofenceScope = 'office' | 'department' | 'employee';

/** PUT /api/geofencing/{scope}/{id} request body. */
export interface SetGeofence {
  latitude: number | null;      // -90..90
  longitude: number | null;     // -180..180
  radiusMeters: number | null;  // 1..100000 (meters)
}

/** GET /api/geofencing item / PUT response. */
export interface ScopeGeofence {
  scope: GeofenceScope;
  scopeId: string;
  scopeName: string;
  enabled: boolean;             // true when a fence is set
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  source: 'direct' | 'office' | null; // 'direct' = own coords; 'office' = inherited
}
