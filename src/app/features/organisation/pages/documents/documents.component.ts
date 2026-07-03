import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../../../core/services/document.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  Document,
  DocumentCategory,
  DocumentVisibility,
} from '../../../../core/models/document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit {
  private readonly docSvc = inject(DocumentService);
  private readonly permSvc = inject(PermissionService);
  private readonly toast = inject(ToastService);

  documents = signal<Document[]>([]);
  loading = signal(true);
  showUploadForm = signal(false);
  uploading = signal(false);

  selectedFile = signal<File | null>(null);

  // Upload form fields
  uploadTitle = '';
  uploadCategory: DocumentCategory = 'hr_policy';
  uploadVisibility: DocumentVisibility = 'all';

  readonly canUpload = computed(() => this.permSvc.can('documents', 2));

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
    this.docSvc.getAll().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load', 'Could not load documents.');
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

  download(doc: Document): void {
    this.docSvc.download(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.title + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.toast.error('Download failed', 'Could not download the document.');
      },
    });
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
