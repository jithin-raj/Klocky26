// ─────────────────────────────────────────────────────────────────────────────
// Shared form option constants
// Import from here instead of re-declaring in each component.
// ─────────────────────────────────────────────────────────────────────────────

// ── Industries ────────────────────────────────────────────────────────────────
export const INDUSTRIES: string[] = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'Retail & E-commerce',
  'Manufacturing',
  'Logistics & Supply Chain',
  'Real Estate',
  'Media & Entertainment',
  'Hospitality',
  'Construction',
  'Legal & Consulting',
  'Government',
  'Other',
];

// ── Company / team sizes ──────────────────────────────────────────────────────
export const COMPANY_SIZES: string[] = [
  '1 – 10',
  '11 – 50',
  '51 – 200',
  '201 – 500',
  '501 – 1000',
  '1000+',
];

// ── Weekdays ──────────────────────────────────────────────────────────────────
export const WEEKDAYS: string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// ── Week-start options (for localisation settings) ────────────────────────────
export const WEEK_STARTS: string[] = ['Monday', 'Sunday', 'Saturday'];

// ── Timezones (rich format — IANA value + display label) ──────────────────────
export const TIMEZONE_OPTIONS: { label: string; value: string }[] = [
  { label: 'IST — India Standard Time (UTC+5:30)',      value: 'Asia/Kolkata'       },
  { label: 'EST — Eastern Time (UTC−5)',                 value: 'America/New_York'   },
  { label: 'CST — Central Time (UTC−6)',                 value: 'America/Chicago'    },
  { label: 'MST — Mountain Time (UTC−7)',                value: 'America/Denver'     },
  { label: 'PST — Pacific Time (UTC−8)',                 value: 'America/Los_Angeles'},
  { label: 'GMT — Greenwich Mean Time (UTC+0)',          value: 'Europe/London'      },
  { label: 'CET — Central European Time (UTC+1)',        value: 'Europe/Berlin'      },
  { label: 'EET — Eastern European Time (UTC+2)',        value: 'Europe/Athens'      },
  { label: 'MSK — Moscow Time (UTC+3)',                  value: 'Europe/Moscow'      },
  { label: 'GST — Gulf Standard Time (UTC+4)',           value: 'Asia/Dubai'         },
  { label: 'PKT — Pakistan Standard Time (UTC+5)',       value: 'Asia/Karachi'       },
  { label: 'BST — Bangladesh Standard Time (UTC+6)',     value: 'Asia/Dhaka'         },
  { label: 'ICT — Indochina Time (UTC+7)',               value: 'Asia/Bangkok'       },
  { label: 'SGT — Singapore Time (UTC+8)',               value: 'Asia/Singapore'     },
  { label: 'JST — Japan Standard Time (UTC+9)',          value: 'Asia/Tokyo'         },
  { label: 'AEST — Australian Eastern Time (UTC+10)',    value: 'Australia/Sydney'   },
  { label: 'NZST — New Zealand Standard Time (UTC+12)',  value: 'Pacific/Auckland'   },
  { label: 'HST — Hawaii Standard Time (UTC−10)',        value: 'Pacific/Honolulu'   },
  { label: 'ART — Argentina Time (UTC−3)',               value: 'America/Sao_Paulo'  },
  { label: 'CAT — Central Africa Time (UTC+2)',          value: 'Africa/Cairo'       },
];

// ── Timezones (plain strings — for simpler dropdowns / registration) ──────────
export const TIMEZONE_STRINGS: string[] = TIMEZONE_OPTIONS.map(t => t.label);

// ── Countries ─────────────────────────────────────────────────────────────────
export const COUNTRIES: string[] = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Singapore',
  'UAE',
  'South Africa',
  'Brazil',
  'Japan',
  'Other',
];

// ── Country → default timezone (IANA) ──────────────────────────────────────────
// A best-effort default for auto-filling the timezone field once a country is
// picked — purely a client-side UX nicety, not authoritative. Several of these
// countries span multiple zones (US, Canada, Australia, Brazil); the value
// here is just the most common/capital-city zone, and the user can still
// change the timezone field afterward. No server endpoint provides this
// mapping (GET /api/tenant/options returns flat, unrelated countries/timezones
// lists) and there's no reason to ask for one — the server can't pick a
// single "right" zone for a multi-zone country any better than this can.
//
// Every value here is deliberately one already present in TIMEZONE_OPTIONS
// above, so the timezone dropdown shows a real selection (not a blank
// placeholder) immediately after picking a country — Canada/France/South
// Africa map to the closest equivalent-offset zone already in that list
// rather than their own capital's zone.
export const COUNTRY_DEFAULT_TIMEZONE: Record<string, string> = {
  'India':          'Asia/Kolkata',
  'United States':  'America/New_York',
  'United Kingdom': 'Europe/London',
  'Canada':         'America/New_York',
  'Australia':      'Australia/Sydney',
  'Germany':        'Europe/Berlin',
  'France':         'Europe/Berlin',
  'Singapore':      'Asia/Singapore',
  'UAE':            'Asia/Dubai',
  'South Africa':   'Africa/Cairo',
  'Brazil':         'America/Sao_Paulo',
  'Japan':          'Asia/Tokyo',
};

// ── Country → default currency ──────────────────────────────────────────────
// Same "best-effort client-side nicety" as COUNTRY_DEFAULT_TIMEZONE above —
// auto-fills the currency field once a country is picked at sign-up, still
// freely editable afterward. Every value here is one already present in
// CURRENCIES; countries without a natural match (South Africa, Brazil) fall
// back to USD rather than introducing a currency with no dropdown entry.
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  'India':          'INR',
  'United States':  'USD',
  'United Kingdom': 'GBP',
  'Canada':         'CAD',
  'Australia':      'AUD',
  'Germany':        'EUR',
  'France':         'EUR',
  'Singapore':      'SGD',
  'UAE':            'AED',
  'South Africa':   'USD',
  'Brazil':         'USD',
  'Japan':          'JPY',
};

// ── Company legal types ───────────────────────────────────────────────────────
export const COMPANY_TYPES: string[] = [
  'Private Limited',
  'Public Limited',
  'LLP',
  'Partnership',
  'Sole Proprietorship',
  'One Person Company (OPC)',
  'Non-Profit / NGO',
  'Government',
  'Other',
];

// ── Currencies ────────────────────────────────────────────────────────────────
export const CURRENCIES: { label: string; value: string }[] = [
  { label: 'INR — Indian Rupee (₹)',        value: 'INR' },
  { label: 'USD — US Dollar ($)',            value: 'USD' },
  { label: 'GBP — British Pound (£)',        value: 'GBP' },
  { label: 'EUR — Euro (€)',                 value: 'EUR' },
  { label: 'AED — UAE Dirham (د.إ)',        value: 'AED' },
  { label: 'SGD — Singapore Dollar (S$)',   value: 'SGD' },
  { label: 'AUD — Australian Dollar (A$)', value: 'AUD' },
  { label: 'JPY — Japanese Yen (¥)',        value: 'JPY' },
  { label: 'CAD — Canadian Dollar (C$)',    value: 'CAD' },
];

// ── Date formats ──────────────────────────────────────────────────────────────
export const DATE_FORMATS: string[] = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'D MMM YYYY',
];

// ── Working day patterns ──────────────────────────────────────────────────────
export const WORKING_DAY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Mon – Fri', value: 'mon-fri' },
  { label: 'Mon – Sat', value: 'mon-sat' },
  { label: 'Mon – Sun', value: 'mon-sun' },
  { label: 'Custom',    value: 'custom'  },
];

// ── Attendance — grace period ─────────────────────────────────────────────────
export const GRACE_PERIOD_OPTIONS: { label: string; value: number }[] = [
  { label: 'No grace',    value: 0  },
  { label: '5 minutes',   value: 5  },
  { label: '10 minutes',  value: 10 },
  { label: '15 minutes',  value: 15 },
  { label: '20 minutes',  value: 20 },
  { label: '30 minutes',  value: 30 },
];

// ── Attendance — half-day threshold ──────────────────────────────────────────
export const HALF_DAY_THRESHOLD_OPTIONS: { label: string; value: number }[] = [
  { label: '3 hours', value: 3 },
  { label: '4 hours', value: 4 },
  { label: '5 hours', value: 5 },
];

// ── Leave year start months ───────────────────────────────────────────────────
export const LEAVE_YEAR_MONTHS: string[] = [
  'January', 'April', 'July', 'October',
];

// ── Branding accent colour presets ────────────────────────────────────────────
export const ACCENT_PRESETS: string[] = [
  '#6366f1', '#8b5cf6', '#a855f7',
  '#3b82f6', '#0ea5e9', '#06b6d4',
  '#14b8a6', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899',
];
