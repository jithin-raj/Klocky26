// ─────────────────────────────────────────────────────────────────────────────
// Upload models — POST /api/uploads/image | /api/uploads/document
//
// Replaces the old "paste a URL" flow: upload the real file, get a loadable URL
// back, then store that URL in the existing logoUrl / avatarUrl / photoUrl field.
// ─────────────────────────────────────────────────────────────────────────────

/** Where an uploaded image is used — sent as the `category` form field. */
export type ImageUploadCategory = 'logo' | 'avatar' | 'attendance-photo';

/** Response (data) from an upload endpoint. */
export interface UploadResult {
  /** Absolute, browser-loadable URL — assign to logoUrl/avatarUrl/photoUrl. */
  url: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}
