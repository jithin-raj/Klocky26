import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentService } from '../../../../core/services/document.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  Document,
  DocumentCategory,
  DocumentVisibility,
} from '../../../../core/models/document.model';

type PreviewKind = 'loading' | 'pdf' | 'image' | 'text' | 'unsupported' | 'error';

/** Best-effort MIME → file extension, used since the API doesn't expose one directly. */
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
};

@Component({
  selector: 'app-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit, OnDestroy {
  private readonly docSvc = inject(DocumentService);
  private readonly permSvc = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  documents = signal<Document[]>([]);
  loading = signal(true);
  loadError = signal('');
  showUploadForm = signal(false);
  uploading = signal(false);

  selectedFile = signal<File | null>(null);

  // Upload form fields
  uploadTitle = '';
  uploadCategory: DocumentCategory = 'hr_policy';
  uploadVisibility: DocumentVisibility = 'all';

  readonly canUpload = computed(() => this.permSvc.can('documents', 2));
  readonly isAdminView = computed(() => this.permSvc.can('documents', 2));

  readonly categoryLabels: Record<DocumentCategory, string> = {
    hr_policy: 'HR Policy',
    leave_policy: 'Leave Policy',
    handbook: 'Handbook',
    other: 'Other',
  };

  readonly visibilityLabels: Record<DocumentVisibility, string> = {
    all: 'All Employees',
    hr: 'HR Only',
    management: 'Management',
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.docSvc.getAll().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? 'Could not load documents. Please try again.';
        this.loadError.set(msg);
      },
    });
  }

  onFileChange(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.selectedFile.set(f);
  }

  toggleUploadForm(): void {
    this.showUploadForm.update(v => !v);
    if (!this.showUploadForm()) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.uploadTitle = '';
    this.uploadCategory = 'hr_policy';
    this.uploadVisibility = 'all';
    this.selectedFile.set(null);
  }

  submitUpload(): void {
    if (!this.uploadTitle.trim() || !this.selectedFile()) return;
    this.uploading.set(true);
    this.docSvc
      .upload({
        file: this.selectedFile()!,
        title: this.uploadTitle.trim(),
        category: this.uploadCategory,
        visibleTo: this.uploadVisibility,
      })
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.showUploadForm.set(false);
          this.resetForm();
          this.toast.success('Uploaded', 'Document uploaded successfully.');
          this.load();
        },
        error: (err) => {
          this.uploading.set(false);
          this.toast.error(
            'Upload failed',
            err?.error?.message ?? 'Could not upload document.',
          );
        },
      });
  }

  private saveBlob(doc: Document, blob: Blob): void {
    const ext = EXT_BY_MIME[blob.type];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ext ? `${doc.title}.${ext}` : doc.title;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Direct download without opening the preview (used by the row action). */
  download(doc: Document): void {
    this.docSvc.download(doc.id).subscribe({
      next: (blob) => this.saveBlob(doc, blob),
      error: () => {
        this.toast.error('Download failed', 'Could not download the document.');
      },
    });
  }

  // ── Preview modal ─────────────────────────────────────────────────────────

  previewDoc  = signal<Document | null>(null);
  previewKind = signal<PreviewKind>('loading');
  previewUrl  = signal<SafeResourceUrl | null>(null);
  previewText = signal('');
  private _previewObjectUrl: string | null = null;

  /**
   * Preview hits the dedicated /preview endpoint (not /download) — per the API,
   * only application/pdf, image/* and text/* are meant to be rendered inline;
   * anything else falls back to a real download via downloadFromPreview().
   */
  openPreview(doc: Document): void {
    this.previewDoc.set(doc);
    this.previewKind.set('loading');
    this.previewUrl.set(null);
    this.previewText.set('');

    this.docSvc.preview(doc.id).subscribe({
      next: (blob) => {
        if (blob.type === 'application/pdf') {
          this._setObjectUrl(blob);
          this.previewKind.set('pdf');
        } else if (blob.type.startsWith('image/')) {
          this._setObjectUrl(blob);
          this.previewKind.set('image');
        } else if (blob.type.startsWith('text/')) {
          blob.text().then(text => {
            this.previewText.set(text);
            this.previewKind.set('text');
          });
        } else {
          this.previewKind.set('unsupported');
        }
      },
      error: () => {
        this.previewKind.set('error');
      },
    });
  }

  private _setObjectUrl(blob: Blob): void {
    this._previewObjectUrl = URL.createObjectURL(blob);
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this._previewObjectUrl));
  }

  closePreview(): void {
    if (this._previewObjectUrl) URL.revokeObjectURL(this._previewObjectUrl);
    this._previewObjectUrl = null;
    this.previewDoc.set(null);
    this.previewUrl.set(null);
    this.previewText.set('');
  }

  /** Always the real /download file (not the preview blob) — preview and download are separate endpoints. */
  downloadFromPreview(): void {
    const doc = this.previewDoc();
    if (doc) this.download(doc);
  }

  ngOnDestroy(): void {
    if (this._previewObjectUrl) URL.revokeObjectURL(this._previewObjectUrl);
  }

  deleteDoc(doc: Document): void {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    this.docSvc.delete(doc.id).subscribe({
      next: () => {
        this.toast.success('Deleted', `"${doc.title}" was deleted.`);
        this.load();
      },
      error: (err) => {
        this.toast.error(
          'Delete failed',
          err?.error?.message ?? 'Could not delete the document.',
        );
      },
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
