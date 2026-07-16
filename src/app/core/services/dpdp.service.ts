import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  DpdpConsentStatusItem, DpdpDocument, DpdpDocumentType,
  PublishPolicyRequest, DpdpConsentReportRow, PrivacyPolicyDto,
} from '../models/dpdp.model';

/**
 * The spec says GET /dpdp/documents/{type} returns the document directly,
 * but /documents/* endpoints on this backend have already shown one
 * inconsistently-nested envelope (see asArray() / api-list.util.ts) — this
 * defends against the same thing happening here: if the raw response is
 * itself the document (has `.content`), use it as-is; otherwise unwrap a
 * `{ data: {...} }` envelope. Prevents a silently-empty document body.
 */
function unwrapDocument(res: unknown): DpdpDocument {
  if (res && typeof res === 'object' && 'content' in res) return res as DpdpDocument;
  const inner = (res as { data?: unknown } | null)?.data;
  if (inner && typeof inner === 'object' && 'content' in inner) return inner as DpdpDocument;
  return res as DpdpDocument;
}

// ─────────────────────────────────────────────────────────────────────────────
// DpdpService — raw GET/POST /api/dpdp/* calls (DPDP consent gating).
// State (consent-status + "does anything need accepting") lives in
// DpdpConsentService instead — this is the thin HTTP layer only.
//
// Confirmed contract (UserOnly auth unless noted):
//   GET  /dpdp/documents/consent-status       -> { data: [...] }
//   GET  /dpdp/documents/{documentType}       -> object directly, NOT wrapped
//   POST /dpdp/documents/{documentType}/accept    -> 204, no body
//   POST /dpdp/documents/{documentType}/withdraw  -> 204, no body
//        {documentType} must be "privacy_policy" | "terms_of_service" (else 400)
//   GET  /dpdp/admin/policies                 -> { data: PrivacyPolicyDto[] }        (compliance perm)
//   POST /dpdp/admin/policies                 -> publish a new version               (compliance perm)
//   GET  /dpdp/admin/consent-report           -> { data: [...] }, privacy_policy only (compliance perm)
//
// No-auth (pre-login):
//   GET  /dpdp/public/documents/{documentType}?orgSlug={orgSlug}
//        404 { error } if the org or document doesn't exist; 400 { error } for
//        a bad documentType or missing orgSlug. Docs are per-organisation, so
//        orgSlug is required — there's no org-agnostic document to fall back to.
//
// Legacy (still valid, defaults to privacy_policy) — deliberately NOT used
// here: GET /policy, GET /consent-status, POST /consent/accept, POST /consent/withdraw.
// New code should always go through /documents/* as above.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DpdpService {
  private readonly api = inject(ApiService);

  getConsentStatus(): Observable<ApiResponse<DpdpConsentStatusItem[]>> {
    return this.api.get<ApiResponse<DpdpConsentStatusItem[]>>('/dpdp/documents/consent-status');
  }

  /** Spec says returned directly (no { data } envelope) — unwrapped defensively regardless, see unwrapDocument(). */
  getDocument(documentType: DpdpDocumentType): Observable<DpdpDocument> {
    return this.api.get<unknown>(`/dpdp/documents/${documentType}`).pipe(map(unwrapDocument));
  }

  /** No auth. `orgSlug` is required — the login form's real login code, not orgUrlName. */
  getPublicDocument(documentType: DpdpDocumentType, orgSlug: string): Observable<DpdpDocument> {
    return this.api.get<unknown>(`/dpdp/public/documents/${documentType}`, { orgSlug }).pipe(map(unwrapDocument));
  }

  /** 204 on success. */
  accept(documentType: DpdpDocumentType): Observable<void> {
    return this.api.post<void>(`/dpdp/documents/${documentType}/accept`, {});
  }

  /** 204 on success. */
  withdraw(documentType: DpdpDocumentType): Observable<void> {
    return this.api.post<void>(`/dpdp/documents/${documentType}/withdraw`, {});
  }

  // ── Admin (requires "compliance" permission) ────────────────────────────

  getPolicies(): Observable<ApiResponse<PrivacyPolicyDto[]>> {
    return this.api.get<ApiResponse<PrivacyPolicyDto[]>>('/dpdp/admin/policies');
  }

  publishPolicy(payload: PublishPolicyRequest): Observable<ApiResponse<PrivacyPolicyDto>> {
    return this.api.post<ApiResponse<PrivacyPolicyDto>>('/dpdp/admin/policies', payload);
  }

  /** privacy_policy only. */
  getConsentReport(): Observable<ApiResponse<DpdpConsentReportRow[]>> {
    return this.api.get<ApiResponse<DpdpConsentReportRow[]>>('/dpdp/admin/consent-report');
  }
}
