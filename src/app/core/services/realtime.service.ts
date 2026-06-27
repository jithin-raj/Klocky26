import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppStateService } from './app-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// RealtimeService — single shared SignalR connection to /hubs/notifications
//
// Per SIGNALR_ANGULAR_GUIDE.md: ONE connection per browser tab, reused by every
// feature (attendance today, future announcements/leave-approvals). Never call
// `new HubConnectionBuilder()` anywhere else.
//
// Usage:
//   this.realtime.connect();           // once, right after login / on app init if authenticated
//   this.realtime.on<AttendanceRecordResponse>('attendance.updated').subscribe(...)
//   this.realtime.disconnect();        // on logout
// ─────────────────────────────────────────────────────────────────────────────

// Events the hub can push today (per backend): user-targeted attendance +
// notification events, plus org/admin broadcasts. Extend as new ones land.
const KNOWN_EVENTS = ['attendance.updated', 'notification.created'];

@Injectable({ providedIn: 'root' })
export class RealtimeService {

  private readonly appState = inject(AppStateService);

  private connection: signalR.HubConnection | null = null;
  private readonly events$ = new Subject<{ event: string; payload: unknown }>();

  connect(): void {
    if (this.connection) return; // already connected — reuse it

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.realtimeHubUrl, {
        accessTokenFactory: () => this.appState.getAccessTokenSync() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(environment.enableApiLogging ? signalR.LogLevel.Warning : signalR.LogLevel.Error)
      .build();

    for (const eventName of KNOWN_EVENTS) {
      this.connection.on(eventName, (payload) => this.events$.next({ event: eventName, payload }));
    }

    this.connection.start().catch((err) => console.error('[Realtime] connect failed', err));
  }

  disconnect(): void {
    this.connection?.stop();
    this.connection = null;
  }

  /** Filter to one event name from the single shared stream. */
  on<T = unknown>(eventName: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const sub = this.events$.subscribe((e) => {
        if (e.event === eventName) subscriber.next(e.payload as T);
      });
      return () => sub.unsubscribe();
    });
  }
}
