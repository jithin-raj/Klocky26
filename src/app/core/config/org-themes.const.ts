import { OrgTheme } from '../services/org-theme.service';

// ─────────────────────────────────────────────────────────────────────────────
// All built-in org colour presets
// ─────────────────────────────────────────────────────────────────────────────
export const ORG_THEMES: Record<string, OrgTheme> = {

  // ── App default ─────────────────────────────────────────────────────────
  /** Default app theme — Deep Teal / Viridian */
  default: {
    accent:         '#0d9488',
    accentDark:     '#0a6b63',
    textAccent:     '#5eead4',
    textAccentPale: '#99f6e4',
    pageBg:         '#122723',
  },

  /** Klocky internal team */
  klocky: {
    accent:         '#0d9488',
    accentDark:     '#0a6b63',
    textAccent:     '#5eead4',
    textAccentPale: '#99f6e4',
    pageBg:         '#05110f',
  },

  // ── Demo / org presets ───────────────────────────────────────────────────
  /** Acme Corp — deep indigo */
  acme: {
    accent:         '#4f46e5',
    accentDark:     '#3730a3',
    textAccent:     '#a5b4fc',
    textAccentPale: '#c7d2fe',
    pageBg:         '#07080f',
  },

  /** Globex Inc — warm amber */
  globex: {
    accent:         '#d97706',
    accentDark:     '#b45309',
    textAccent:     '#fcd34d',
    textAccentPale: '#fde68a',
    pageBg:         '#0d0a03',
  },

  /** Stark Industries — rose red */
  stark: {
    accent:         '#e11d48',
    accentDark:     '#be123c',
    textAccent:     '#fda4af',
    textAccentPale: '#fecdd3',
    pageBg:         '#0d0408',
  },

  /** Initech — electric violet */
  initech: {
    accent:         '#7c3aed',
    accentDark:     '#6d28d9',
    textAccent:     '#c4b5fd',
    textAccentPale: '#ddd6fe',
    pageBg:         '#08060f',
  },

  /** Umbrella Corp — deep crimson */
  umbrella: {
    accent:         '#dc2626',
    accentDark:     '#b91c1c',
    textAccent:     '#fca5a5',
    textAccentPale: '#fee2e2',
    pageBg:         '#0d0404',
  },

  /** Waystar Royco — slate navy */
  waystar: {
    accent:         '#1d4ed8',
    accentDark:     '#1e40af',
    textAccent:     '#93c5fd',
    textAccentPale: '#bfdbfe',
    pageBg:         '#04060f',
  },

  /** Pied Piper — emerald green */
  piedpiper: {
    accent:         '#059669',
    accentDark:     '#047857',
    textAccent:     '#6ee7b7',
    textAccentPale: '#a7f3d0',
    pageBg:         '#030f0a',
  },

  /** Hooli — fuchsia pink */
  hooli: {
    accent:         '#c026d3',
    accentDark:     '#a21caf',
    textAccent:     '#e879f9',
    textAccentPale: '#f0abfc',
    pageBg:         '#0d040f',
  },

  /** Dunder Mifflin — steel blue */
  dundermifflin: {
    accent:         '#0284c7',
    accentDark:     '#0369a1',
    textAccent:     '#7dd3fc',
    textAccentPale: '#bae6fd',
    pageBg:         '#030a0f',
  },

  /** Vandelay Industries — warm orange */
  vandelay: {
    accent:         '#ea580c',
    accentDark:     '#c2410c',
    textAccent:     '#fdba74',
    textAccentPale: '#fed7aa',
    pageBg:         '#0d0602',
  },

  // ── Light theme examples ─────────────────────────────────────────────────
  // Note: Light themes are automatically detected and text colors are adapted
  
  /** Light Mode — Clean white with blue accent */
  lightblue: {
    accent:         '#2563eb',
    accentDark:     '#1e40af',
    textAccent:     '#1e3a8a',     // Dark blue for text on light bg
    textAccentPale: '#3b82f6',     // Medium blue for secondary text
    pageBg:         '#ffffff',
  },

  /** Light Mode — Cream with purple accent */
  lightpurple: {
    accent:         '#7c3aed',
    accentDark:     '#6d28d9',
    textAccent:     '#5b21b6',     // Dark purple for text on light bg
    textAccentPale: '#8b5cf6',     // Medium purple for secondary text
    pageBg:         '#fefce8',
  },
};

/**
 * Slugs that can be randomly assigned during demo / guest login.
 * Does NOT include 'default' or 'klocky' (reserved).
 */
export const DEMO_THEME_SLUGS: string[] = Object.keys(ORG_THEMES).filter(
  (k) => k !== 'default' && k !== 'klocky',
);
