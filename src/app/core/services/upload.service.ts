import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { ImageUploadCategory, UploadResult } from '../models/upload.model';

// ─────────────────────────────────────────────────────────────────────────────
// UploadService — file uploads (POST /api/uploads/image | /api/uploads/document)
//
// Multipart (field `file`). Image upload also takes a `category`. Returns
// { url, fileName, sizeBytes, contentType }; feed `url` into the existing
// logoUrl / avatarUrl / photoUrl fields. Any logged-in token works; auth +
// base-url are applied by the usual interceptors via ApiService.
//
//   • image:    max 5 MB, images only
//   • document: max 15 MB, images + pdf/doc/xls/csv/txt
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UploadService {

  private readonly api = inject(ApiService);

  /** POST /api/uploads/image — logos, avatars, clock-in photos. */
  uploadImage(file: File, category: ImageUploadCategory): Observable<UploadResult> {
    return this.api
      .upload<ApiResponse<UploadResult>>('/uploads/image', file, 'file', { category })
      .pipe(map((res) => res.data));
  }

  /** POST /api/uploads/document — pdf/doc/xls/csv/txt + images. */
  uploadDocument(file: File): Observable<UploadResult> {
    return this.api
      .upload<ApiResponse<UploadResult>>('/uploads/document', file)
      .pipe(map((res) => res.data));
  }
}
