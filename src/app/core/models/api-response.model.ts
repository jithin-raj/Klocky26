// ─────────────────────────────────────────────────────────────────────────────
// API Response Models
//
// Every Klocky API response is wrapped in the same envelope:
//   { "data": <payload or null>, "status": 200, "message": "success" }
// Validation errors put field details under `data.error`:
//   { "data": { "error": { "email": [...] } }, "status": 400, "message": "Validation failed" }
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message: string;
}

/** Field-level validation error payload, found at `error.error.data.error` on a 400 response. */
export type ApiValidationErrors = Record<string, string[]>;

/**
 * Paged list payload — what the global envelope's `data` holds for the paginated
 * list endpoints (employees, org-roles, departments). i.e. the full response is
 * `ApiResponse<Paged<T>>` and rows live at `response.data.data`.
 */
export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Query params for paginated list endpoints */
export interface PaginationParams {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
