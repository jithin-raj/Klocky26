export type DocumentCategory = 'hr_policy'|'leave_policy'|'handbook'|'other';
export type DocumentVisibility = 'all'|'hr'|'management';

export interface Document {
  id: string; title: string; category: DocumentCategory;
  fileUrl: string;
  uploadedBy: { id: string; name: string }; visibleTo: DocumentVisibility; uploadedAt: string;
}

export interface UploadDocumentRequest {
  file: File; title: string; category: DocumentCategory; visibleTo: DocumentVisibility;
}
