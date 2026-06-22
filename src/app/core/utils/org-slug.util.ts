// ─────────────────────────────────────────────────────────────────────────────
// Org identifier formats — see ORG_URL_NAME_INTEGRATION.md.
//
// Two distinct identifiers, never interchangeable:
//  • orgSlug    — the login code (e.g. "experion.klock"), always ".klock"-
//    suffixed, used in POST /api/users/auth/login's body and similar. Users
//    only ever type the short code; toOrgSlug() appends the suffix.
//  • orgUrlName — the SPA route segment (e.g. "experion"), short, no suffix,
//    auto-generated at registration, renameable only by a Klock platform
//    admin. Use this — never orgSlug — for `:orgUrlName` in the URL.
// ─────────────────────────────────────────────────────────────────────────────

export const ORG_CODE_SUFFIX = '.klock';

/** Unanchored body — lowercase alphanumeric + hyphens, 1–61 chars, shared by both patterns below. */
const CODE_BODY = '[a-z0-9][a-z0-9-]{0,59}[a-z0-9]|[a-z0-9]';

/** Short code only, no suffix: lowercase alphanumeric + hyphens, 1–61 chars. */
export const ORG_CODE_PATTERN = new RegExp(`^(?:${CODE_BODY})$`);

/** Full slug as the backend stores it — the code pattern plus the required ".klock" suffix. */
export const ORG_SLUG_PATTERN = new RegExp(`^(?:${CODE_BODY})\\${ORG_CODE_SUFFIX}$`);

export function isValidOrgSlugFormat(slug: string): boolean {
  return ORG_SLUG_PATTERN.test(slug.toLowerCase());
}

export function isValidOrgCodeFormat(code: string): boolean {
  return ORG_CODE_PATTERN.test(code.toLowerCase());
}

/**
 * Normalizes whatever the user typed (e.g. "Experion", "experion.klock",
 * "  experion  ") into the full backend slug ("experion.klock") — strips a
 * suffix if the user already typed one (case-insensitively) before
 * re-appending it, so it's never duplicated.
 */
export function toOrgSlug(rawCode: string): string {
  const code = rawCode.trim().toLowerCase().replace(/\.klock$/i, '');
  return `${code}${ORG_CODE_SUFFIX}`;
}

/**
 * orgUrlName format per ORG_URL_NAME_INTEGRATION.md §3: lowercase
 * letters/numbers/hyphens, 2–40 chars, can't start/end with a hyphen.
 */
export const ORG_URL_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidOrgUrlNameFormat(urlName: string): boolean {
  return urlName.length >= 2 && urlName.length <= 40 && ORG_URL_NAME_PATTERN.test(urlName.toLowerCase());
}

/** Normalizes raw user input into a candidate orgUrlName — lowercase, spaces collapsed to hyphens. */
export function toOrgUrlNameCandidate(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}
