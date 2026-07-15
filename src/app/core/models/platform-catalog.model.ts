// ─────────────────────────────────────────────────────────────────────────────
// Platform catalog admin models — Klock-admin CRUD over the subscription
// catalogue (public tiers + add-ons). GET /api/plans, checkout pricing and
// feature resolution all read from the DB, so edits here are live immediately.
//
// Endpoints (platform bearer):
//   GET    /api/platform/catalog
//   POST   /api/platform/catalog/plans        (PlanUpsertRequest)
//   PUT    /api/platform/catalog/plans/{code}  (PlanUpsertRequest; code immutable)
//   DELETE /api/platform/catalog/plans/{code}  (409 if orgs are on it → deactivate)
//   POST   /api/platform/catalog/addons        (AddonUpsertRequest)
//   PUT    /api/platform/catalog/addons/{code}  (AddonUpsertRequest; code immutable)
//   DELETE /api/platform/catalog/addons/{code}
// ─────────────────────────────────────────────────────────────────────────────

/** A plan as returned by the admin catalog (superset of the public PlanDto). */
export interface CatalogPlan {
  code: string;
  name: string;
  description: string;
  maxEmployees: number | null;   // null = unlimited
  maxAdmins: number | null;      // null = unlimited
  monthlyPrice: number;
  /** Server-derived (typically monthly × 10); read-only. */
  annualPrice: number;
  currency: string;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

/** An add-on as returned by the admin catalog. */
export interface CatalogAddon {
  code: string;
  name: string;
  feature: string;
  monthlyPrice: number;
  annualPrice: number;
  isActive: boolean;
  sortOrder: number;
}

/** GET /api/platform/catalog response (data) — includes inactive entries. */
export interface CatalogResponse {
  plans: CatalogPlan[];
  addons: CatalogAddon[];
  extraSeatMonthlyPrice: number;
  trialDays: number;
  currency: string;
}

/** POST/PUT plan body. `code` is immutable after create — omit it when editing. */
export interface PlanUpsertRequest {
  code?: string;
  name: string;
  description: string;
  maxEmployees: number | null;
  maxAdmins: number | null;
  monthlyPrice: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

/** POST/PUT add-on body. `code` is immutable after create — omit it when editing. */
export interface AddonUpsertRequest {
  code?: string;
  name: string;
  feature: string;
  monthlyPrice: number;
  isActive: boolean;
  sortOrder: number;
}
