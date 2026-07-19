import { Injectable, signal } from '@angular/core';
import { MarkPresentBulkResultItem } from '../../../core/models/attendance-request.model';

export interface MarkPresentItem {
  userId: string;
  userName: string;
  /** ISO date (YYYY-MM-DD) of the absent/half/missing day being corrected. */
  date: string;
}

export interface MarkPresentParams {
  items: MarkPresentItem[];
}

interface MarkPresentState extends MarkPresentParams {
  resolve: (result: MarkPresentBulkResultItem[] | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkPresentDialogService — global "open a dialog, await the result" state,
// same pattern as ModalService/UpgradePromptService. One MarkPresentDialogComponent
// is mounted once (shell) and renders whenever `state()` is non-null.
//
// Works for both single-item and bulk flows — pass 1 item or many; the dialog
// picks POST .../mark-present vs .../mark-present/bulk internally. Resolves
// with the final per-item results (so callers can check `.some(r => r.success)`
// to decide whether to refresh), or null if the admin cancelled without
// submitting anything.
//
//   const results = await this.markPresentDialog.open({ items: [...] });
//   if (results?.some(r => r.success)) { /* refresh this page's own data */ }
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MarkPresentDialogService {
  private readonly _state = signal<MarkPresentState | null>(null);
  readonly state = this._state.asReadonly();

  open(params: MarkPresentParams): Promise<MarkPresentBulkResultItem[] | null> {
    if (!params.items.length) return Promise.resolve(null);
    return new Promise((resolve) => this._state.set({ ...params, resolve }));
  }

  /** Called by MarkPresentDialogComponent on confirm/cancel. */
  resolve(result: MarkPresentBulkResultItem[] | null): void {
    const s = this._state();
    if (!s) return;
    s.resolve(result);
    this._state.set(null);
  }
}
