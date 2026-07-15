// ─────────────────────────────────────────────────────────────────────────────
// Reference options — GET /api/options (public, no auth). One flat catalogue of
// dropdown values shared by registration + org settings, so both screens always
// agree. Managed by Klock admins via /api/platform/options.
// ─────────────────────────────────────────────────────────────────────────────

export type OptionCategory =
  | 'country' | 'timezone' | 'currency' | 'date_format' | 'time_format'
  | 'clock_in_method' | 'mobile_platform' | 'company_size' | 'week_day' | 'industry';

export interface Option {
  code: string;
  label: string;
  /** For `country`, this is the default IANA timezone code. Null for most others. */
  extra: string | null;
}

/** GET /api/options response (data) — a map of category → options. */
export type OptionsResponse = Record<string, Option[]>;

// ── Platform admin (GET/POST/PUT/DELETE /api/platform/options) ────────────────

export interface OptionAdmin {
  id: string;
  category: string;
  code: string;
  label: string;
  extra: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** POST body — code + category are set on create and immutable thereafter. */
export interface CreateOptionRequest {
  category: string;
  code: string;
  label: string;
  extra?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** PUT body — code/category are immutable, so only these are editable. */
export interface UpdateOptionRequest {
  label: string;
  extra?: string | null;
  sortOrder: number;
  isActive: boolean;
}
