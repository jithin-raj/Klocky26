import { CheckInRuleType, CompanySize, LocationPolicy } from '../models/org-auth.model';

// ─────────────────────────────────────────────────────────────────────────────
// Maps the /free-trial onboarding wizard's display-friendly values (built
// before the real API existed) onto the enums RegisterOrgRequest actually
// expects. Kept separate from the wizard components themselves so the
// mapping is auditable in one place.
//
// Clock-in methods are NOT mapped here — AttendanceSetupTabComponent now
// works directly in the server's own enum values (sourced from
// GET /api/tenant/options), so there's nothing to translate.
// ─────────────────────────────────────────────────────────────────────────────

// AttendanceSetupTabComponent.timezones are "UTC+05:30 — India Standard Time"
// style labels with no IANA id attached. Mapped by the same offsets used in
// TIMEZONE_OPTIONS (core/config/form-options.const.ts) so both onboarding
// paths converge on the same IANA values.
const TIMEZONE_LABEL_TO_IANA: Record<string, string> = {
  'UTC−12:00 — Baker Island': 'Pacific/Auckland',
  'UTC−08:00 — Pacific Time (US)': 'America/Los_Angeles',
  'UTC−07:00 — Mountain Time (US)': 'America/Denver',
  'UTC−06:00 — Central Time (US)': 'America/Chicago',
  'UTC−05:00 — Eastern Time (US)': 'America/New_York',
  'UTC−04:00 — Atlantic Time': 'America/New_York',
  'UTC−03:00 — Brasília': 'America/Sao_Paulo',
  'UTC+00:00 — UTC / Greenwich': 'Europe/London',
  'UTC+01:00 — Central European Time': 'Europe/Berlin',
  'UTC+02:00 — Eastern European Time': 'Europe/Athens',
  'UTC+03:00 — Moscow / Riyadh': 'Europe/Moscow',
  'UTC+04:00 — Gulf Standard Time': 'Asia/Dubai',
  'UTC+05:00 — Pakistan Standard Time': 'Asia/Karachi',
  'UTC+05:30 — India Standard Time': 'Asia/Kolkata',
  'UTC+06:00 — Bangladesh Standard Time': 'Asia/Dhaka',
  'UTC+07:00 — Indochina Time': 'Asia/Bangkok',
  'UTC+08:00 — China / Singapore / HK': 'Asia/Singapore',
  'UTC+09:00 — Japan / Korea': 'Asia/Tokyo',
  'UTC+10:00 — Australia Eastern': 'Australia/Sydney',
  'UTC+12:00 — New Zealand': 'Pacific/Auckland',
};

/** Falls back to Asia/Kolkata if a label is somehow unrecognised — never sends an empty string. */
export function mapTimezoneLabel(label: string): string {
  return TIMEZONE_LABEL_TO_IANA[label] ?? 'Asia/Kolkata';
}

/** '1 – 10' / '1,000+' (en-dash + thousands comma) → '1-10' / '1000+' (CompanySize). */
export function normalizeCompanySize(label: string): CompanySize {
  return label.replace(/,/g, '').replace(/\s*[–-]\s*/, '-') as CompanySize;
}

const LOCATION_RULE_MAP: Record<string, LocationPolicy> = {
  'No Restriction': 'no_restrictions',
  'Office Only (GPS)': 'office_only',
  'Geofenced Area': 'geo_fenced_area',
  'IP Restricted (Office Network)': 'ip_restriction',
};

export function mapLocationRule(label: string): LocationPolicy {
  return LOCATION_RULE_MAP[label] ?? 'no_restrictions';
}

/** 'None' | '5 mins' | '10 mins' | ... | '<n> mins' (custom) → CheckInRuleType + minutes. */
export function mapGracePeriod(label: string): { checkInRuleType: CheckInRuleType; checkInCustomMinutes: number | null } {
  if (!label || label === 'None') return { checkInRuleType: 'none', checkInCustomMinutes: null };
  const minutes = parseInt(label, 10);
  if ([5, 10, 15, 30].includes(minutes)) {
    return { checkInRuleType: String(minutes) as CheckInRuleType, checkInCustomMinutes: null };
  }
  return { checkInRuleType: 'custom', checkInCustomMinutes: Number.isFinite(minutes) ? minutes : null };
}

/** 'After 10 minutes' / 'After 1 hour' → minutes. Falls back to 15 (the registration screen's default). */
export function mapLateThresholdMins(label: string): number {
  if (!label) return 15;
  const n = parseInt(label, 10);
  if (!Number.isFinite(n)) return 15;
  return /hour/i.test(label) ? n * 60 : n;
}
