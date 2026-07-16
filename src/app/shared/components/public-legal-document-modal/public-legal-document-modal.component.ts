import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { DpdpService } from '../../../core/services/dpdp.service';
import { DpdpDocumentType } from '../../../core/models/dpdp.model';

// ─────────────────────────────────────────────────────────────────────────────
// PublicLegalDocumentModalComponent — lets an unauthenticated visitor (login /
// email-step / register screens) read the Privacy Policy or Terms of Service
// without signing in first, via the no-auth GET /dpdp/public/documents/{type}
// ?orgSlug={orgSlug} endpoint. Docs are per-organisation, so orgSlug is
// required — if the caller doesn't have one yet (no org chosen), that's shown
// as the same graceful "not available yet" state as a 404, per backend's
// guidance, rather than attempting a request that can't succeed.
//
// Usage: drop <app-public-legal-document-modal #legalModal /> once in a
// template, then call legalModal.open('privacy_policy', orgSlug) /
// .open('terms_of_service', orgSlug) from a (click) handler on the existing links.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-public-legal-document-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './public-legal-document-modal.component.html',
  styleUrl: './public-legal-document-modal.component.scss',
})
export class PublicLegalDocumentModalComponent {
  private readonly dpdp = inject(DpdpService);
  private readonly sanitizer = inject(DomSanitizer);

  isOpen = signal(false);
  title = signal('');
  html = signal<SafeHtml | null>(null);
  loading = signal(false);
  notAvailable = signal(false);
  error = signal('');

  open(documentType: DpdpDocumentType, orgSlug: string | null | undefined): void {
    this.isOpen.set(true);
    this.title.set(documentType === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy');
    this.html.set(null);
    this.notAvailable.set(false);
    this.error.set('');

    if (!orgSlug) {
      // No org chosen yet — there's no org-specific document to fetch at all.
      this.loading.set(false);
      this.notAvailable.set(true);
      return;
    }

    this.loading.set(true);
    this.dpdp.getPublicDocument(documentType, orgSlug).subscribe({
      next: (doc) => {
        this.title.set(doc.title || this.title());
        if (!doc.content?.trim()) {
          this.error.set('This document has no content yet.');
          this.loading.set(false);
          return;
        }
        const html = marked.parse(doc.content, { async: false }) as string;
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notAvailable.set(true);
          return;
        }
        this.error.set('Could not load this document right now. Please try again shortly.');
      },
    });
  }

  close(): void {
    this.isOpen.set(false);
  }
}
