import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { RealtimeService } from './realtime.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AppNotification,
  SendNotificationRequest,
  SendNotificationResult,
  normalizeNotification,
} from '../models/notification.model';

// ─────────────────────────────────────────────────────────────────────────────
// NotificationService — in-app notification store
//
// Single source of truth for the header bell + notifications page. Loads the
// user's notifications from the API, keeps an unread count, and folds in live
// `notification.created` pushes from SignalR (RealtimeService). Admin/HR send
// via `send()`. All network calls fail soft — if an endpoint isn't deployed yet
// the UI still works with whatever is already in the store.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);

  private readonly _items = signal<AppNotification[]>([]);
  readonly items = this._items.asReadonly();

  readonly loading = signal(false);
  readonly loaded = signal(false);

  /** Number of unread notifications — drives the bell badge. */
  readonly unreadCount = computed(() => this._items().filter(n => !n.isRead).length);
  /** Most recent few unread, for the header dropdown — read ones live on the full page. */
  readonly recent = computed(() => this._items().filter(n => !n.isRead).slice(0, 6));

  constructor() {
    // Live pushes — a new notification for this user lands in real time.
    this.realtime.on<unknown>('notification.created').subscribe((payload) => {
      const n = normalizeNotification(payload);
      this._items.update(list =>
        list.some(x => x.id === n.id) ? list : [n, ...list]);
    });
  }

  /** GET /api/notifications — the caller's notifications (mine + org-wide). */
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .get<ApiResponse<Paged<unknown> | unknown[]>>('/notifications', { unreadOnly: false })
      .subscribe({
        next: (res) => {
          this._items.set(this.extractList(res?.data).map(normalizeNotification));
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          // Endpoint may not be deployed yet — keep the store empty, stay usable.
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  /** PATCH /api/notifications/{id}/read — mark one read (optimistic, 204). */
  markRead(id: string): void {
    if (!this._items().some(n => n.id === id && !n.isRead)) return;
    this._items.update(list => list.map(n => n.id === id ? { ...n, isRead: true } : n));
    this.api.patch(`/notifications/${id}/read`, {}).subscribe({ error: () => { /* soft */ } });
  }

  /** PATCH /api/notifications/read-all — mark all read (optimistic, 204). */
  markAllRead(): void {
    if (this.unreadCount() === 0) return;
    this._items.update(list => list.map(n => n.isRead ? n : { ...n, isRead: true }));
    this.api.patch('/notifications/read-all', {}).subscribe({ error: () => { /* soft */ } });
  }

  /**
   * POST /api/notifications/send — compose & send (HR/manager/admin).
   * Targets specific employees / departments / roles, or the whole org via
   * `toAll`. Recipients are unioned + de-duplicated server-side. The sender
   * receives any resulting notification back over SignalR, so we don't add it
   * optimistically. Returns { sentTo, orgWide }.
   */
  send(req: SendNotificationRequest): Observable<SendNotificationResult> {
    const toAll = req.toAll === true;
    return this.api.post<ApiResponse<SendNotificationResult> | SendNotificationResult>('/notifications/send', {
      title: req.title,
      body: req.body,
      toAll,
      // When broadcasting, leave the targeted arrays off entirely.
      userIds:       toAll ? undefined : nonEmpty(req.userIds),
      departmentIds: toAll ? undefined : nonEmpty(req.departmentIds),
      orgRoleIds:    toAll ? undefined : nonEmpty(req.orgRoleIds),
      userId:        toAll ? undefined : (req.userId ?? undefined),
    }).pipe(
      // The API wraps the result in the standard envelope ({ data: { sentTo, orgWide } }).
      // Unwrap it so the toast can show the real count; tolerate an un-enveloped shape too.
      map((res) => {
        const r = (res as ApiResponse<SendNotificationResult>)?.data ?? (res as SendNotificationResult);
        return r ?? { sentTo: 0, orgWide: toAll };
      }),
    );
  }

  clear(): void {
    this._items.set([]);
    this.loaded.set(false);
  }

  /** Accepts either a paged envelope (`{ data: [...] }`) or a bare array. */
  private extractList(data: Paged<unknown> | unknown[] | null | undefined): unknown[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as Paged<unknown>).data)) return (data as Paged<unknown>).data;
    return [];
  }
}

/** Drop empty arrays so we don't send `[]` the API would have to ignore. */
function nonEmpty(arr?: string[]): string[] | undefined {
  return arr && arr.length ? arr : undefined;
}
