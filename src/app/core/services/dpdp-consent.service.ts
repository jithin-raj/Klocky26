import { Injectable, inject, signal, computed } from '@angular/core';
import { tap, catchError, of } from 'rxjs';
import { DpdpService } from './dpdp.service';
import { DpdpConsentStatusItem } from '../models/dpdp.model';
import { asArray } from '../utils/api-list.util';

// ─────────────────────────────────────────────────────────────────────────────
// DpdpConsentService — single source of truth for "does this user need to
// review/accept a legal document right now." Loaded after login, after every
// token refresh, and on shell mount (covers hard refresh / deep link) — see
// UserAuthService.login()/refreshToken() and ShellComponent.ngOnInit().
//
// LegalConsentModalComponent (shared) reads `needsAcceptance` and blocks the
// whole app behind a stepper until it's false again.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DpdpConsentService {
  private readonly dpdp = inject(DpdpService);

  private readonly _items = signal<DpdpConsentStatusItem[]>([]);
  private readonly _loaded = signal(false);

  readonly items = this._items.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Documents the user still has to review + accept, most-recently-published-first isn't guaranteed — just server order. */
  readonly pending = computed(() => this._items().filter(i => i.needsAcceptance));
  readonly needsAcceptance = computed(() => this.pending().length > 0);

  /** Refetches consent-status. Best-effort — a failure here must never block the app from loading. */
  load() {
    this.dpdp.getConsentStatus().pipe(
      tap((res) => {
        // /dpdp/documents/consent-status has shown the same double-nested
        // { data: { data: [...] } } quirk as /tasks/pending, /tasks/work and
        // /documents — asArray() normalizes either shape defensively.
        this._items.set(asArray<DpdpConsentStatusItem>(res.data as any));
        this._loaded.set(true);
      }),
      catchError(() => {
        // Don't flip `loaded` — a transient failure shouldn't be read as
        // "confirmed nothing pending"; the modal simply won't show until a
        // subsequent load() (next refresh/shell-mount) succeeds.
        return of(null);
      }),
    ).subscribe();
  }

  /** Called by the consent modal right after a successful accept, to move to the next step / close. */
  refresh() {
    this.load();
  }

  clear() {
    this._items.set([]);
    this._loaded.set(false);
  }
}
