import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { unwrapObject } from '../utils/api-list.util';
import { AiStatus, AiChatMessage, AiChatResponse, AiReportType, AiReportResponse } from '../models/ai.model';

// ─────────────────────────────────────────────────────────────────────────────
// AiService — GET/POST /api/ai/*. Same bearer auth as the rest of the app.
//
// Status is loaded once and cached for the session (ShellComponent.ngOnInit
// calls loadStatus() — same pattern as SubscriptionService/PermissionService).
// Every AI UI surface (chat widget, report cards) reads the `available`/
// `locked` signals here instead of each calling /ai/status itself.
//
// Response shapes are unwrapped defensively via unwrapObject() — this
// backend has repeatedly shipped an extra { data: {...} } nesting level on
// endpoints whose own spec says "returned directly" (dpdp.service.ts,
// leave.service.ts), so the same defense is applied here pre-emptively
// rather than waiting for a bug report.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly api = inject(ApiService);

  private readonly _status = signal<AiStatus | null>(null);
  private _statusLoading = false;

  readonly status = this._status.asReadonly();
  /** The only flag most UI needs — render AI surfaces only when this is true. */
  readonly available = computed(() => this._status()?.available ?? false);
  readonly configured = computed(() => this._status()?.configured ?? false);
  readonly entitled = computed(() => this._status()?.entitled ?? false);
  /** Deployment has AI, but this org's plan doesn't — show the locked teaser, not a full hide. */
  readonly locked = computed(() => !!this._status() && this.configured() && !this.entitled());

  /** GET /api/ai/status — cached for the session; safe to call from many components, only fetches once. */
  loadStatus(): void {
    if (this._status() || this._statusLoading) return;
    this._statusLoading = true;
    this.api.get<unknown>('/ai/status').pipe(
      map(res => unwrapObject<AiStatus>(res, 'available')),
    ).subscribe({
      next: (s) => { this._status.set(s); this._statusLoading = false; },
      error: () => {
        // Fail closed — treat an unreachable status endpoint as "no AI" rather
        // than leaving the UI stuck deciding, so the chat button/cards just don't render.
        this._status.set({ available: false, configured: false, entitled: false });
        this._statusLoading = false;
      },
    });
  }

  /** Flip local state to "not entitled" immediately after a 403 feature_not_in_plan, without waiting for a re-fetch. */
  markNotEntitled(): void {
    const s = this._status();
    if (s) this._status.set({ ...s, available: false, entitled: false });
  }

  chat(message: string, history: AiChatMessage[] = []): Observable<AiChatResponse> {
    return this.api.post<unknown>('/ai/chat', { message, history }).pipe(
      map(res => unwrapObject<AiChatResponse>(res, 'answer')),
    );
  }

  report(type: AiReportType = 'overview'): Observable<AiReportResponse> {
    return this.api.post<unknown>('/ai/report', { type }).pipe(
      map(res => unwrapObject<AiReportResponse>(res, 'narrative')),
    );
  }

  clear(): void {
    this._status.set(null);
    this._statusLoading = false;
  }
}
