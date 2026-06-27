import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { RealtimeService } from './realtime.service';
import { ApiResponse, Paged } from '../models/api-response.model';
import {
  AppNotification,
  SendNotificationRequest,
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
  /** Most recent few, for the header dropdown. */
  readonly recent = computed(() => this._items().slice(0, 6));

  constructor() {
    // Live pushes — a new notification for this user lands in real time.
    this.realtime.on<unknown>('notification.created').subscribe((payload) => {
      const n = normalizeNotification(payload);
      this._items.update(list =>
        list.some(x => x.id === n.id) ? list : [n, ...list]);
    });
  }

  /** GET /api/notifications — load the current user's notifications. */
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .get<ApiResponse<Paged<unknown> | unknown[]>>('/notifications', { page: 1, pageSize: 50 })
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

  /** Mark one as read (optimistic). */
  markRead(id: string): void {
    if (!this._items().some(n => n.id === id && !n.isRead)) return;
    this._items.update(list => list.map(n => n.id === id ? { ...n, isRead: true } : n));
    this.api.post(`/notifications/${id}/read`, {}).subscribe({ error: () => { /* soft */ } });
  }

  /** Mark every notification as read (optimistic). */
  markAllRead(): void {
    if (this.unreadCount() === 0) return;
    this._items.update(list => list.map(n => n.isRead ? n : { ...n, isRead: true }));
    this.api.post('/notifications/read-all', {}).subscribe({ error: () => { /* soft */ } });
  }

  /** POST /api/notifications — compose & send (admin/HR). */
  send(req: SendNotificationRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<ApiResponse<unknown>>('/notifications', req).pipe(
      // If the API echoes the created record back to the sender, fold it in.
      tap((res) => {
        const data = (res as ApiResponse<unknown>)?.data;
        if (data && typeof data === 'object') {
          const n = normalizeNotification(data);
          this._items.update(list =>
            list.some(x => x.id === n.id) ? list : [n, ...list]);
        }
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
