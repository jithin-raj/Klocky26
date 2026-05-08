import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ORG_THEMES } from '../config/org-themes.const';

// ─────────────────────────────────────────────────────────────────────────────
// OrgTheme — the colour contract every organisation provides
// ─────────────────────────────────────────────────────────────────────────────
export interface OrgTheme {
  /** Main brand colour (hex) e.g. "#0d9488" */
  accent: string;
  /** Darker shade of accent for gradients */
  accentDark: string;
  /** Light/pale variant for text & icons on dark backgrounds */
  textAccent: string;
  /** Even lighter pale variant for heading gradients */
  textAccentPale: string;
  /** Dark page background tinted toward the accent */
  pageBg: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in presets — swap or extend as organisations are onboarded
// ─────────────────────────────────────────────────────────────────────────────
/** Slug used by the Klocky internal team — always maps to the default theme */
export const KLOCKY_TEAM_SLUG = 'klock';

/** localStorage key for persisting the active org slug across page reloads */
const STORAGE_KEY = 'klocky_org_slug';

const THEMES: Record<string, OrgTheme> = ORG_THEMES;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class OrgThemeService {

  private readonly doc = inject(DOCUMENT) as Document;
  private _current = signal<OrgTheme>(THEMES['globex']);

  // ── Apply by org slug / id ──────────────────────────────────────────────

  /**
   * Generate a complete theme from a single accent color.
   * Auto-generates accentDark, textAccent, textAccentPale, and pageBg.
   * 
   * @param accentColor - The main brand color (e.g., '#0d9488')
   * @returns Complete OrgTheme object
   * 
   * @example
   *   const theme = orgThemeService.generateThemeFromColor('#ff5733');
   */
  generateThemeFromColor(accentColor: string): OrgTheme {
    const luminance = this._getLuminance(accentColor);
    const isLightAccent = luminance > 0.5;

    if (isLightAccent) {
      // Light accent color → use light background
      return {
        accent: accentColor,
        accentDark: this._adjustBrightness(accentColor, -0.15),
        textAccent: this._adjustBrightness(accentColor, -0.35),
        textAccentPale: this._adjustBrightness(accentColor, -0.15),
        pageBg: '#ffffff',
      };
    } else {
      // Dark accent color → use dark background
      return {
        accent: accentColor,
        accentDark: this._adjustBrightness(accentColor, -0.2),
        textAccent: this._adjustBrightness(accentColor, 0.4),
        textAccentPale: this._adjustBrightness(accentColor, 0.6),
        pageBg: this._generatePageBg(accentColor),
      };
    }
  }

  /**
   * Call this after login, once you know the org's slug.
   * Pass a slug that matches a key in THEMES, or a full OrgTheme object.
   *
   * @example
   *   orgThemeService.apply('acme');
   *   orgThemeService.apply({ accent: '#7c3aed', ... });
   */
  apply(orgSlugOrTheme: string | OrgTheme): void {
    const theme: OrgTheme = typeof orgSlugOrTheme === 'string'
      ? (THEMES[orgSlugOrTheme] ?? THEMES['default'])
      : orgSlugOrTheme;

    this._current.set(theme);
    this._writeCssVars(theme);

    // Persist so the theme survives page reloads
    if (typeof orgSlugOrTheme === 'string') {
      try { localStorage.setItem(STORAGE_KEY, orgSlugOrTheme); } catch { /* SSR / private-mode */ }
    } else {
      // For custom theme objects, save the accent color
      try { localStorage.setItem(STORAGE_KEY, `custom:${theme.accent}`); } catch { /* SSR / private-mode */ }
    }
  }

  /**
   * Re-apply the last org theme from localStorage.
   * Call this in ShellComponent.ngOnInit so the theme is restored on reload.
   */
  restoreFromStorage(): void {
    try {
      const slug = localStorage.getItem(STORAGE_KEY);
      if (!slug) {
        this.apply('default');
        return;
      }
      
      // Check if it's a custom theme with accent color
      if (slug.startsWith('custom:')) {
        const accentColor = slug.substring(7); // Remove 'custom:' prefix
        const theme = this.generateThemeFromColor(accentColor);
        this.apply(theme);
      } else {
        this.apply(slug);
      }
    } catch {
      this.apply('default');
    }
  }

  /** Reset to the default app theme and clear persisted slug */
  reset(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.apply('default');
  }

  get current(): OrgTheme {
    return this._current();
  }

  /** Get the current theme signal for reactive access */
  get theme() {
    return this._current;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _writeCssVars(t: OrgTheme): void {
    const root = this.doc.documentElement;
    const rgb = this._hexToRgb(t.accent);
    const rgbLight = this._hexToRgb(t.textAccent);

    // Auto-detect if this is a light theme and adapt colors accordingly
    const isLightTheme = this._isLightColor(t.pageBg);
    const adaptedTheme = isLightTheme ? this._adaptToLightTheme(t) : t;

    // Set data attribute for CSS to conditionally style based on theme mode
    root.setAttribute('data-theme-mode', isLightTheme ? 'light' : 'dark');

    root.style.setProperty('--th-page-bg',          adaptedTheme.pageBg);
    root.style.setProperty('--th-accent',            adaptedTheme.accent);
    root.style.setProperty('--th-accent-dark',       adaptedTheme.accentDark);
    root.style.setProperty('--th-text-accent',       adaptedTheme.textAccent);
    root.style.setProperty('--th-text-accent-pale',  adaptedTheme.textAccentPale);

    // ──────────────────────────────────────────────────────────
    // Universal text color variables (light/dark adaptive)
    // ──────────────────────────────────────────────────────────
    if (isLightTheme) {
      // Light theme colors
      root.style.setProperty('--app-bg',          '#f9fafb');
      root.style.setProperty('--card-bg',         '#ffffff');
      root.style.setProperty('--text',            '#0f172a');
      root.style.setProperty('--text-light',      '#64748b');
      root.style.setProperty('--text-lighter',    '#94a3b8');
      root.style.setProperty('--border',          '#e2e8f0');
      root.style.setProperty('--border-light',    '#f1f5f9');
      root.style.setProperty('--btn-text',        '#000000');
    } else {
      // Dark theme colors - keep app background light gray
      root.style.setProperty('--app-bg',          '#edf1f7');
      root.style.setProperty('--card-bg',         '#ffffff');
      root.style.setProperty('--text',            '#0f172a');
      root.style.setProperty('--text-light',      '#64748b');
      root.style.setProperty('--text-lighter',    '#94a3b8');
      root.style.setProperty('--border',          '#e2e8f0');
      root.style.setProperty('--border-light',    '#f1f5f9');
      root.style.setProperty('--btn-text',        '#ffffff');
    }

    // RGB channel tokens for rgba() usage in SCSS
    const finalRgb = this._hexToRgb(adaptedTheme.accent);
    const finalRgbLight = this._hexToRgb(adaptedTheme.textAccent);
    root.style.setProperty('--th-ar', String(finalRgb.r));
    root.style.setProperty('--th-ag', String(finalRgb.g));
    root.style.setProperty('--th-ab', String(finalRgb.b));
    root.style.setProperty('--th-lr', String(finalRgbLight.r));
    root.style.setProperty('--th-lg', String(finalRgbLight.g));
    root.style.setProperty('--th-lb', String(finalRgbLight.b));

    // Keep the shared --accent in sync so ui-input/select/toggle update too
    root.style.setProperty('--accent', adaptedTheme.accent);
  }

  private _hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    const int   = parseInt(clean, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8)  & 255,
      b:  int        & 255,
    };
  }

  /**
   * Calculate relative luminance of a color (0 = black, 1 = white)
   * Uses W3C formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
   */
  private _getLuminance(hex: string): number {
    const rgb = this._hexToRgb(hex);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      const normalized = val / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Check if a color is considered "light" (luminance > 0.5)
   */
  private _isLightColor(hex: string): boolean {
    return this._getLuminance(hex) > 0.5;
  }

  /**
   * Darken a color by reducing RGB values
   */
  private _darkenColor(hex: string, percent: number = 0.3): string {
    const rgb = this._hexToRgb(hex);
    const r = Math.max(0, Math.round(rgb.r * (1 - percent)));
    const g = Math.max(0, Math.round(rgb.g * (1 - percent)));
    const b = Math.max(0, Math.round(rgb.b * (1 - percent)));
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Adapt a theme for light backgrounds by inverting text colors
   */
  private _adaptToLightTheme(theme: OrgTheme): OrgTheme {
    // If background is light, we need dark text
    // Create darker versions of the accent for text
    return {
      ...theme,
      textAccent: this._darkenColor(theme.accent, 0.4),      // Dark accent for headings
      textAccentPale: this._darkenColor(theme.accent, 0.2),  // Medium accent for text
      accentDark: this._darkenColor(theme.accent, 0.5),      // Even darker for borders/shadows
    };
  }

  /**
   * Adjust brightness of a color by a percentage
   * @param hex - Color in hex format
   * @param percent - Positive to lighten, negative to darken (-1 to 1)
   */
  private _adjustBrightness(hex: string, percent: number): string {
    const rgb = this._hexToRgb(hex);
    
    const adjust = (val: number) => {
      if (percent > 0) {
        // Lighten: move towards 255
        return Math.min(255, Math.round(val + (255 - val) * percent));
      } else {
        // Darken: move towards 0
        return Math.max(0, Math.round(val * (1 + percent)));
      }
    };

    const r = adjust(rgb.r);
    const g = adjust(rgb.g);
    const b = adjust(rgb.b);
    
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Generate a dark page background with a subtle tint of the accent color
   */
  private _generatePageBg(accentHex: string): string {
    const rgb = this._hexToRgb(accentHex);
    // Create a very dark version with just a hint of the accent color
    const r = Math.max(3, Math.round(rgb.r * 0.05));
    const g = Math.max(3, Math.round(rgb.g * 0.05));
    const b = Math.max(3, Math.round(rgb.b * 0.05));
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }
}
