import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { Document, UploadDocumentRequest } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {

  private readonly api = inject(ApiService);

  getAll(): Observable<Document[]> {
    return this.api.get<ApiResponse<Document[]>>('/documents')
      .pipe(map(res => res.data ?? []));
  }

  upload(req: UploadDocumentRequest): Observable<Document> {
    return this.api.upload<ApiResponse<Document>>('/documents', req.file, 'file', {
      title: req.title,
      category: req.category,
      visibleTo: req.visibleTo,
    }).pipe(map(r => r.data));
  }

  download(id: string): Observable<Blob> {
    return this.api.getBlob(`/documents/${id}/download`);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/documents/${id}`);
  }
}
