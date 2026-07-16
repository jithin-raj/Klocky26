import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { DpdpConsentService } from '../../../../core/services/dpdp-consent.service';
import { DpdpService } from '../../../../core/services/dpdp.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ModalService } from '../../../../shared/components/ui-modal/modal.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { UiInputComponent } from '../../../../shared/components/ui-input/ui-input.component';
import { UiTextareaComponent } from '../../../../shared/components/ui-textarea/ui-textarea.component';
import { UiSelectComponent, SelectOption } from '../../../../shared/components/ui-select/ui-select.component';
import { OrgDatePipe } from '../../../../shared/pipes/localization.pipes';
import { asArray } from '../../../../core/utils/api-list.util';
import { DpdpConsentStatusItem, DpdpConsentReportRow, DpdpDocumentType } from '../../../../core/models/dpdp.model';

const DOCUMENT_TYPE_OPTIONS: { label: string; value: DpdpDocumentType }[] = [
  { label: 'Privacy Policy', value: 'privacy_policy' },
  { label: 'Terms of Service', value: 'terms_of_service' },
];

@Component({
  selector: 'app-legal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiInputComponent, UiTextareaComponent, UiSelectComponent, OrgDatePipe],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.scss',
})
export class LegalComponent {
  private readonly consent = inject(DpdpConsentService);
  private readonly dpdp = inject(DpdpService);
  private readonly permissions = inject(PermissionService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly items = this.consent.items;
  readonly canManagePolicies = computed(() => this.permissions.can('compliance', 2));

  readonly documentTypeOptions: SelectOption[] = DOCUMENT_TYPE_OPTIONS;

  constructor() {
    if (!this.consent.loaded()) this.consent.load();
  }

  // ── View a document ──────────────────────────────────────────────────────
  viewing = signal<DpdpConsentStatusItem | null>(null);
  viewingHtml = signal<SafeHtml | null>(null);
  viewingLoading = signal(false);
  viewingError = signal('');

  view(item: DpdpConsentStatusItem): void {
    this.viewing.set(item);
    this.viewingHtml.set(null);
    this.viewingError.set('');
    this.viewingLoading.set(true);
    this.dpdp.getDocument(item.documentType).subscribe({
      next: (doc) => {
        // Returned directly by the server — not wrapped in { data }.
        if (!doc.content?.trim()) {
          this.viewingError.set('This document has no content yet.');
          this.viewingLoading.set(false);
          return;
        }
        const html = marked.parse(doc.content, { async: false }) as string;
        this.viewingHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.viewingLoading.set(false);
      },
      error: (err) => {
        this.viewingLoading.set(false);
        this.viewingError.set(err?.error?.error ?? err?.error?.message ?? 'Could not load this document.');
      },
    });
  }

  closeView(): void {
    this.viewing.set(null);
  }

  // ── Withdraw consent ─────────────────────────────────────────────────────
  withdrawing = signal<string | null>(null);

  async withdraw(item: DpdpConsentStatusItem): Promise<void> {
    const ok = await this.modal.confirm({
      title: `Withdraw consent for "${item.title}"?`,
      message: 'You\'ll be asked to review and accept this document again before you can keep using Klock. Continue?',
      confirmLabel: 'Withdraw consent',
      variant: 'danger',
    });
    if (!ok) return;

    this.withdrawing.set(item.documentType);
    this.dpdp.withdraw(item.documentType).subscribe({
      next: () => {
        this.withdrawing.set(null);
        this.toast.info('Consent withdrawn', `You'll need to re-accept "${item.title}" to continue.`);
        this.consent.refresh();
      },
      error: (err) => {
        this.withdrawing.set(null);
        this.toast.error('Could not withdraw', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Admin — publish a new version ────────────────────────────────────────
  publishOpen = signal(false);
  publishType = signal<DpdpDocumentType>('privacy_policy');
  publishVersion = signal('');
  publishTitle = signal('');
  publishContent = signal('');
  publishEffectiveFrom = signal('');
  publishing = signal(false);

  openPublish(): void {
    this.publishType.set('privacy_policy');
    this.publishVersion.set('');
    this.publishTitle.set('');
    this.publishContent.set('');
    this.publishEffectiveFrom.set('');
    this.publishOpen.set(true);
  }

  closePublish(): void {
    this.publishOpen.set(false);
  }

  submitPublish(): void {
    const version = this.publishVersion().trim();
    const title = this.publishTitle().trim();
    const content = this.publishContent().trim();
    if (!version || !title || !content || this.publishing()) return;

    this.publishing.set(true);
    this.dpdp.publishPolicy({
      version,
      title,
      content,
      documentType: this.publishType(),
      effectiveFrom: this.publishEffectiveFrom() || undefined,
    }).subscribe({
      next: (res) => {
        this.publishing.set(false);
        this.publishOpen.set(false);
        this.toast.success('Published', `${res.data.title} v${res.data.version} is live — every employee will be asked to re-accept it.`);
        this.consent.refresh();
      },
      error: (err) => {
        this.publishing.set(false);
        this.toast.error('Could not publish', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  // ── Admin — consent report ───────────────────────────────────────────────
  reportOpen = signal(false);
  reportRows = signal<DpdpConsentReportRow[]>([]);
  reportLoading = signal(false);
  reportError = signal('');

  openReport(): void {
    this.reportOpen.set(true);
    this.reportLoading.set(true);
    this.reportError.set('');
    this.dpdp.getConsentReport().subscribe({
      next: (res) => {
        this.reportRows.set(asArray<DpdpConsentReportRow>(res.data as any));
        this.reportLoading.set(false);
      },
      error: (err) => {
        this.reportLoading.set(false);
        this.reportError.set(err?.error?.error ?? err?.error?.message ?? 'Could not load the consent report.');
      },
    });
  }

  closeReport(): void {
    this.reportOpen.set(false);
  }

  statusLabel(item: DpdpConsentStatusItem): string {
    if (item.withdrawn) return 'Withdrawn';
    if (item.needsAcceptance) return 'Needs review';
    return 'Accepted';
  }

  statusClass(item: DpdpConsentStatusItem): string {
    if (item.withdrawn) return 'lg-status--withdrawn';
    if (item.needsAcceptance) return 'lg-status--pending';
    return 'lg-status--accepted';
  }
}
