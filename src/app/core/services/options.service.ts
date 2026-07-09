import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, shareReplay, tap, map, catchError } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { Option, OptionCategory, OptionsResponse } from '../models/options.model';
import type { SelectOption } from '../../shared/components/ui-select/ui-select.component';

// ─────────────────────────────────────────────────────────────────────────────
// OptionsService — loads GET /api/options once (public, no auth) and caches it.
// Registration and Org Settings both read from here so their dropdowns can never
// drift apart. Klock-admin edits to /api/platform/options are live on next load.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OptionsService {
  private readonly api = inject(ApiService);

  private readonly _options = signal<OptionsResponse>({});
  readonly options = computed(() => this._options());
  readonly loaded = computed(() => Object.keys(this._options()).length > 0);

  /** In-flight/cached request so concurrent callers share one network hit. */
  private request$?: Observable<OptionsResponse>;

  /** Load once and cache. Safe to call repeatedly — returns the cached stream. */
  ensureLoaded(): Observable<OptionsResponse> {
    if (this.loaded()) return of(this._options());
    if (!this.request$) {
      this.request$ = this.api.get<ApiResponse<OptionsResponse>>('/options').pipe(
        map(res => res.data ?? {}),
        tap(data => this._options.set(data)),
        catchError(() => of({} as OptionsResponse)),
        shareReplay(1),
      );
    }
    return this.request$;
  }

  /** Force a refresh (e.g. after admin edits in the same session). */
  reload(): Observable<OptionsResponse> {
    this.request$ = undefined;
    this._options.set({});
    return this.ensureLoaded();
  }

  /** Raw options for a category (empty until loaded). */
  get(category: OptionCategory): Option[] {
    return this._options()[category] ?? [];
  }

  /** ui-select options ({ label, value: code }) for a category. */
  selectOptions(category: OptionCategory): SelectOption[] {
    return this.get(category).map(o => ({ label: o.label, value: o.code }));
  }

  /** The `extra` of a specific option code within a category (e.g. a country's default timezone). */
  extraFor(category: OptionCategory, code: string): string | null {
    return this.get(category).find(o => o.code === code)?.extra ?? null;
  }

  /** A country's default IANA timezone code, for country → timezone auto-select. */
  defaultTimezoneForCountry(countryCode: string): string | null {
    return this.extraFor('country', countryCode);
  }

  /** Resolve a code to its human label within a category (falls back to the code). */
  labelFor(category: OptionCategory, code: string | null | undefined): string {
    if (!code) return '';
    return this.get(category).find(o => o.code === code)?.label ?? code;
  }
}
