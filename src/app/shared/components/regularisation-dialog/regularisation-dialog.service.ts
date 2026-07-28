import { Injectable, signal } from '@angular/core';

export interface RegularisationDialogParams {
  /** ISO date (YYYY-MM-DD) the request is being raised for. */
  date: string;
  /** Shown in the dialog header, e.g. "Monday, 12 May". */
  dateLabel: string;
}

interface RegularisationDialogState extends RegularisationDialogParams {
  resolve: (submitted: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// RegularisationDialogService — global "open a dialog, await the result" state,
// same pattern as MarkPresentDialogService. One RegularisationDialogComponent is
// mounted once (shell) and renders whenever `state()` is non-null.
//
// Lets any page (the attendance calendar, in particular) raise an attendance
// regularisation request inline — without navigating to the Tasks workspace —
// then refresh its own data if the request was submitted.
//
//   const submitted = await this.regDialog.open({ date, dateLabel });
//   if (submitted) { /* refresh this page's own data */ }
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RegularisationDialogService {
  private readonly _state = signal<RegularisationDialogState | null>(null);
  readonly state = this._state.asReadonly();

  open(params: RegularisationDialogParams): Promise<boolean> {
    return new Promise((resolve) => this._state.set({ ...params, resolve }));
  }

  /** Called by RegularisationDialogComponent on submit/cancel. */
  resolve(submitted: boolean): void {
    const s = this._state();
    if (!s) return;
    s.resolve(submitted);
    this._state.set(null);
  }
}
