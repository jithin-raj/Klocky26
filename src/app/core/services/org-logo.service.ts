import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrgLogoService {
  private readonly api = inject(ApiService);

  /**
   * POST /api/org/logo — admin-only, multipart/form-data.
   * Defensively unwraps the response: some responses come back flat
   * (`{ logoUrl }`), others enveloped (`{ data: { logoUrl } }` or with the
   * generic uploads' `url` field instead of `logoUrl`) — same inconsistency
   * class as other endpoints on this backend.
   *
   * Returns both the raw `logoUrl` (persist this — e.g. in the tenant-settings
   * save payload) and a `displayUrl` with a cache-busting query param (bind
   * this to the header/sidebar/preview `<img>` so the new logo shows up
   * immediately instead of the browser serving a stale cached copy at an
   * unchanged URL — the reason a reload was previously needed to see it).
   */
  uploadLogo(file: File): Observable<{ logoUrl: string; displayUrl: string }> {
    return this.api.upload<unknown>('/org/logo', file).pipe(
      map((res) => {
        const body = (res && typeof res === 'object' && 'data' in (res as Record<string, unknown>))
          ? (res as { data: unknown }).data
          : res;
        const logoUrl = (body as { logoUrl?: string; url?: string } | null)?.logoUrl
          ?? (body as { logoUrl?: string; url?: string } | null)?.url
          ?? '';
        const displayUrl = logoUrl ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
        return { logoUrl, displayUrl };
      }),
    );
  }

  /** Public GET URL — anonymous, no token required (safe to use on login screen). */
  publicLogoUrl(orgSlug: string): string {
    return `${environment.apiBaseUrl}/org/logo/${orgSlug}`;
  }
}
