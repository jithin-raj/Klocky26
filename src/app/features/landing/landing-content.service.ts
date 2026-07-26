import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ApiResponse } from '../../core/models/api-response.model';
import { AUTH_SCOPE } from '../../core/http/auth-scope.context';

// ─────────────────────────────────────────────────────────────────────────────
// LandingContentService
//
// Fetches the OPTIONAL, server-driven content for the public landing page.
// Everything here is "show only if real data exists" — the component renders an
// honest fallback (product value props / use-cases) when a section is empty, so
// we never fabricate organisations, customer logos, metrics or testimonials.
//
// The endpoint is expected to be PUBLIC (no auth). We tag the request with a
// non-'user' AUTH_SCOPE purely so the global 401 handler can't try a token
// refresh / redirect a logged-out visitor to /login if the endpoint is missing
// or misconfigured — any error simply resolves to empty content.
//
// Backend contract (all fields optional; omit or return [] to hide a section):
//   GET /public/landing  ->  ApiResponse<LandingContent>
// ─────────────────────────────────────────────────────────────────────────────

export interface LandingStat {
  /** e.g. "Organisations", "Employees managed", "Uptime" */
  label: string;
  /** Pre-formatted for display, e.g. "512", "10,480", "99.9%", "4.9 ★" */
  value: string;
}

export interface LandingCustomer {
  name: string;
  /** Absolute URL to a logo image. If absent, the name is shown as a wordmark. */
  logoUrl?: string;
}

export interface LandingTestimonial {
  quote: string;
  author: string;
  /** e.g. "Head of People, Meridian Labs" */
  role: string;
  avatarUrl?: string;
  /** 1–5; renders that many stars. Defaults to 5 if omitted. */
  rating?: number;
}

export interface LandingAnnouncement {
  /** When false (or object omitted) the banner is hidden. */
  enabled: boolean;
  text: string;
  ctaLabel?: string;
  /** Router path (e.g. "/free-trial") or absolute URL. */
  ctaUrl?: string;
}

export interface LandingContent {
  stats?: LandingStat[];
  customers?: LandingCustomer[];
  testimonials?: LandingTestimonial[];
  announcement?: LandingAnnouncement | null;
}

const EMPTY: LandingContent = {
  stats: [],
  customers: [],
  testimonials: [],
  announcement: null,
};

@Injectable({ providedIn: 'root' })
export class LandingContentService {
  private api = inject(ApiService);

  getContent(): Observable<LandingContent> {
    const context = new HttpContext().set(AUTH_SCOPE, 'platform');
    return this.api
      .get<ApiResponse<LandingContent>>('/public/landing', undefined, { context })
      .pipe(
        map((res) => ({ ...EMPTY, ...(res?.data ?? {}) })),
        catchError(() => of(EMPTY)),
      );
  }
}
