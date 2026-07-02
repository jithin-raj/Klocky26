import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrgLogoService {
  private readonly api = inject(ApiService);

  /** POST /api/org/logo — admin-only, multipart/form-data. Returns cache-busted URL. */
  uploadLogo(file: File): Observable<{ logoUrl: string }> {
    return this.api.upload<{ logoUrl: string }>('/org/logo', file);
  }

  /** Public GET URL — anonymous, no token required (safe to use on login screen). */
  publicLogoUrl(orgSlug: string): string {
    return `${environment.apiBaseUrl}/org/logo/${orgSlug}`;
  }
}
