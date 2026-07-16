import {
  Component, ChangeDetectionStrategy, inject, signal, computed, effect,
  ElementRef, ViewChild, AfterViewInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { marked } from 'marked';
import { DpdpConsentService } from '../../../core/services/dpdp-consent.service';
import { DpdpService } from '../../../core/services/dpdp.service';
import { DpdpDocument, DpdpDocumentType } from '../../../core/models/dpdp.model';
import { ToastService } from '../ui-toast/toast.service';

// ─────────────────────────────────────────────────────────────────────────────
// LegalConsentModalComponent — blocking full-screen stepper shown whenever
// DpdpConsentService.needsAcceptance() is true (wired into shell.component.html,
// unconditionally, next to the other global overlays). One step per pending
// document: fetch its markdown content, require scroll-to-bottom + a tick
// checkbox, POST accept, re-fetch consent-status, advance.
//
// "Later" (dismiss()) is a session-only snooze, not a real bypass — there's
// still no route guard behind this modal, so it's the only gate there is;
// dismissing just hides it until the next navigation, so a user mid-task
// isn't hard-stopped, but they can't permanently avoid it either.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-legal-consent-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './legal-consent-modal.component.html',
  styleUrl: './legal-consent-modal.component.scss',
})
export class LegalConsentModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollEl') scrollEl?: ElementRef<HTMLElement>;

  private readonly consent = inject(DpdpConsentService);
  private readonly dpdp = inject(DpdpService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly pending = this.consent.pending;
  readonly stepIndex = signal(0);

  /**
   * Session-only dismiss — hides the modal so the user can finish whatever
   * they were doing, but it's NOT a real bypass: it resets on every route
   * navigation (and naturally on refresh/relogin, since this is in-memory).
   * A user who dismisses and then clicks anywhere in the app sees it again.
   */
  readonly dismissed = signal(false);
  private readonly _navSub: Subscription;

  dismiss(): void {
    this.dismissed.set(true);
  }
  /** Clamp in case a step disappears mid-flow (e.g. re-fetch drops an item). */
  readonly current = computed(() => {
    const list = this.pending();
    const i = Math.min(this.stepIndex(), Math.max(0, list.length - 1));
    return list[i] ?? null;
  });

  document = signal<DpdpDocument | null>(null);
  documentHtml = signal<SafeHtml | null>(null);
  loadingDoc = signal(false);
  loadError = signal('');
  scrolledToBottom = signal(false);
  ticked = signal(false);
  accepting = signal(false);
  acceptError = signal('');

  constructor() {
    this._navSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(() => this.dismissed.set(false));

    // Re-fetch the document whenever the active step changes (including on
    // first render, and again after accept() re-derives `pending()`).
    effect(() => {
      const item = this.current();
      if (item) this._loadDocument(item.documentType);
    });
  }

  ngAfterViewInit(): void {
    this._checkScroll();
  }

  ngOnDestroy(): void {
    this._navSub.unsubscribe();
  }

  private _loadDocument(documentType: DpdpDocumentType): void {
    this.loadingDoc.set(true);
    this.loadError.set('');
    this.acceptError.set('');
    this.scrolledToBottom.set(false);
    this.ticked.set(false);
    this.document.set(null);
    this.documentHtml.set(null);
    // Cleared here (not in accept()'s success handler) so the Accept button
    // stays disabled through the brief gap between a successful accept and
    // consent-status re-fetch resolving — otherwise it would flash re-enabled
    // for the just-accepted document and allow a pointless duplicate submit.
    this.accepting.set(false);

    this.dpdp.getDocument(documentType).subscribe({
      next: (doc) => {
        // Returned directly by the server — not wrapped in { data }.
        this.document.set(doc);
        if (!doc.content?.trim()) {
          // Distinct from a network error — the fetch worked, there's just
          // nothing to show, so don't block acceptance behind an empty scroll gate.
          this.loadError.set('This document has no content yet. Please contact your admin.');
          this.loadingDoc.set(false);
          return;
        }
        const html = marked.parse(doc.content, { async: false }) as string;
        this.documentHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loadingDoc.set(false);
        // Content just swapped in — re-check whether it's short enough to
        // already be "at the bottom" (no scrollbar needed at all).
        setTimeout(() => this._checkScroll(), 0);
      },
      error: (err) => {
        this.loadingDoc.set(false);
        this.loadError.set(err?.error?.error ?? err?.error?.message ?? 'Could not load this document. Please try again.');
      },
    });
  }

  onScroll(e: Event): void {
    void e;
    this._checkScroll();
  }

  private _checkScroll(): void {
    const el = this.scrollEl?.nativeElement;
    if (!el) return;
    // 24px slack — exact-pixel bottom detection is unreliable across browsers/zoom.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom && !this.scrolledToBottom()) this.scrolledToBottom.set(true);
  }

  toggleTick(): void {
    if (!this.scrolledToBottom()) return;
    this.ticked.set(!this.ticked());
  }

  accept(): void {
    const item = this.current();
    if (!item || !this.ticked() || this.accepting()) return;
    this.accepting.set(true);
    this.acceptError.set('');

    this.dpdp.accept(item.documentType).subscribe({
      next: () => {
        // `accepting` deliberately stays true here — cleared by _loadDocument
        // once the next step (or nothing, if this was the last one) resolves.
        this.consent.refresh();
        // Stay on the same index — `pending()` shrinks as items clear, so
        // index 0 now points at the next document (or the list is empty and
        // the whole modal unmounts via the shell's *ngIf).
        this.stepIndex.set(0);
      },
      error: (err) => {
        this.accepting.set(false);
        if (err?.status === 409) {
          this.acceptError.set('No current version of this document is published right now. Please contact support.');
          return;
        }
        this.acceptError.set(err?.error?.error ?? err?.error?.message ?? 'Could not record your acceptance. Please try again.');
        this.toast.error('Could not save', 'Please try again.');
      },
    });
  }

  retry(): void {
    const item = this.current();
    if (item) this._loadDocument(item.documentType);
  }
}
