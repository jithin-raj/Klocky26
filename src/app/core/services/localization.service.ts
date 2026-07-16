import { Injectable, inject, computed } from '@angular/core';
import { AppStateService } from './app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// LocalizationService — org-wide timezone/date/time/currency, sourced from
// GET /api/users/auth/me (EmployeeUser.timezone/dateFormat/timeFormat/currency).
// These are the same values the admin configures in Org Settings — /me just
// makes them readable by every user, so this service doesn't own any storage
// of its own: AppStateService.user() (already persisted + encrypted) is the
// single source of truth. Refreshing /me anywhere in the app — after login,
// after token refresh, after an admin saves org settings — updates this
// service's output for free.
//
// Usage:
//   private readonly loc = inject(LocalizationService);
//   this.loc.formatDate(row.createdAt)       // '07/07/2026'
//   this.loc.formatTime(row.clockInAt)       // '09:15' | '09:15 AM'
//   this.loc.formatDateTime(row.updatedAt)
//   this.loc.formatCurrency(amount)          // '₹1,250'
// Or via the pipes in shared/pipes/localization.pipes.ts for templates.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
const DEFAULT_TIME_FORMAT: '12h' | '24h' = '24h';
const DEFAULT_CURRENCY = 'INR';

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly appState = inject(AppStateService);

  readonly timezone   = computed(() => this.appState.user()?.timezone || DEFAULT_TIMEZONE);
  readonly dateFormat = computed(() => this.appState.user()?.dateFormat || DEFAULT_DATE_FORMAT);
  readonly timeFormat = computed(() => this.appState.user()?.timeFormat || DEFAULT_TIME_FORMAT);
  readonly currency   = computed(() => this.appState.user()?.currency || DEFAULT_CURRENCY);

  /** dd/MM/yyyy etc → the Intl.DateTimeFormat option pattern for the time part. */
  readonly timePattern = computed(() => (this.timeFormat() === '12h' ? 'hh:mm a' : 'HH:mm'));

  /**
   * Renders a UTC instant (ISO string or Date) as a date in the org's
   * timezone, using the org's configured dateFormat. Returns '—' for
   * null/invalid input so callers don't need their own guard.
   *
   * Use this for genuine instants that carry a time-of-day (createdAt,
   * completedAt, clock-in/out, notification timestamps). For pure calendar
   * dates with no time component (leave dates, holidays, joining date, an
   * "effective from" date), use `formatDateOnly` instead — converting a
   * date-only value through a timezone can roll it back/forward a day
   * depending on the org's UTC offset, since "2026-07-15" parses as UTC
   * midnight and isn't really an instant at all.
   */
  formatDate(value: string | Date | null | undefined): string {
    const date = this.toDate(value);
    if (!date) return '—';
    const { year, month, day } = this.zonedParts(date, this.timezone());
    return this.applyDatePattern(year, month, day);
  }

  /**
   * Renders a pure calendar date (no time-of-day, no timezone shift) using
   * the org's configured dateFormat. See `formatDate` for why this is a
   * separate method rather than always converting through the org timezone.
   */
  formatDateOnly(value: string | Date | null | undefined): string {
    const date = this.toDate(value);
    if (!date) return '—';
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return this.applyDatePattern(year, month, day);
  }

  private applyDatePattern(year: string, month: string, day: string): string {
    return this.dateFormat()
      .replace(/yyyy/g, year)
      .replace(/yy/g, year.slice(-2))
      .replace(/MM/g, month)
      .replace(/dd/g, day);
  }

  /** Renders a UTC instant as a time in the org's timezone + timeFormat. */
  formatTime(value: string | Date | null | undefined): string {
    const date = this.toDate(value);
    if (!date) return '—';
    const { hour, minute } = this.zonedParts(date, this.timezone());
    return this.applyTimeFormat(parseInt(hour, 10), minute);
  }

  /**
   * Renders a bare wall-clock string (e.g. office hours, a shift's start/end
   * time — "HH:mm", no date, no timezone) using the org's 12h/24h preference.
   * Use this instead of `formatTime` for values that were never an instant —
   * there's no timezone conversion to do, just a display-format choice.
   */
  formatTimeString(value: string | null | undefined): string {
    if (!value) return '—';
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return value;
    return this.applyTimeFormat(h, String(m).padStart(2, '0'));
  }

  private applyTimeFormat(h24: number, minute: string): string {
    if (this.timeFormat() === '12h') {
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${minute} ${period}`;
    }
    return `${String(h24).padStart(2, '0')}:${minute}`;
  }

  formatDateTime(value: string | Date | null | undefined): string {
    const date = this.toDate(value);
    if (!date) return '—';
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  /** Formats a money amount using the org's currency code. */
  formatCurrency(amount: number, opts?: { maximumFractionDigits?: number }): string {
    const code = this.currency();
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
      }).format(amount);
    } catch {
      return `${code} ${amount}`;
    }
  }

  private toDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = typeof value === 'string' ? new Date(value) : value;
    return isNaN(date.getTime()) ? null : date;
  }

  /** Reads an instant's date/time components as they fall in `timeZone`. */
  private zonedParts(date: Date, timeZone: string): { year: string; month: string; day: string; hour: string; minute: string } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    // Some engines render midnight as "24" under hour12:false — normalise to "00".
    const hour = map['hour'] === '24' ? '00' : map['hour'];
    return { year: map['year'], month: map['month'], day: map['day'], hour, minute: map['minute'] };
  }
}
