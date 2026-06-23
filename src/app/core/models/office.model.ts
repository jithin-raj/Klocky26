// ─────────────────────────────────────────────────────────────────────────────
// Office models — INTEGRATION_GUIDE.md §7.1 (and §6 geofencing)
//
// latitude/longitude/geoRadiusM must be supplied together or not at all — an
// office without coordinates is just an address label, not a geofence.
// ─────────────────────────────────────────────────────────────────────────────

/** POST/PUT /api/offices request body */
export interface OfficeRequest {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  geoRadiusM?: number;
}

/** Office record — POST/PUT/GET /api/offices response item (data) */
export interface Office {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  geoRadiusM: number | null;
}
