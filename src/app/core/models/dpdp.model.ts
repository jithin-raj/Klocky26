// ─────────────────────────────────────────────────────────────────────────────
// DPDP (Digital Personal Data Protection) consent — Privacy Policy / Terms of
// Service gating. Confirmed endpoint contract — see dpdp.service.ts header.
// ─────────────────────────────────────────────────────────────────────────────

export type DpdpDocumentType = 'privacy_policy' | 'terms_of_service';

/** GET /api/dpdp/documents/consent-status — wrapped in { data }. One entry per legal document type. */
export interface DpdpConsentStatusItem {
  documentType: DpdpDocumentType;
  title: string;
  currentVersion: string;
  needsAcceptance: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  withdrawn: boolean;
}

/** GET /api/dpdp/documents/{documentType} — returned DIRECTLY, not wrapped in { data }. */
export interface DpdpDocument {
  id: string;
  documentType: DpdpDocumentType;
  version: string;
  title: string;
  /** Markdown — render with the `marked` library, sanitized before binding. */
  content: string;
  effectiveFrom: string | null;
  isCurrent: boolean;
  createdAt: string;
}

/** GET /api/dpdp/admin/policies — wrapped in { data } */
export type PrivacyPolicyDto = DpdpDocument;

/**
 * POST /api/dpdp/admin/policies — publish a new version (requires "compliance"
 * permission). `version` is caller-supplied, not server-generated.
 * `documentType` defaults to "privacy_policy" server-side when omitted.
 */
export interface PublishPolicyRequest {
  version: string;
  title: string;
  content: string;
  effectiveFrom?: string;
  documentType?: DpdpDocumentType;
}

/**
 * GET /api/dpdp/admin/consent-report — wrapped in { data }. privacy_policy
 * only (no documentType on each row).
 */
export interface DpdpConsentReportRow {
  userId: string;
  employeeName: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  withdrawn: boolean;
  onCurrentVersion: boolean;
}
