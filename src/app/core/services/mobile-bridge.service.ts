import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AppStateService } from './app-state.service';
import { AttendanceStateService } from './attendance-state.service';

// ─────────────────────────────────────────────────────────────────────────────
// MobileBridgeService — bridge between the React-Native shell and this SPA
//
// The RN WebView injects `window.__IS_MOBILE__ = true` and dispatches custom
// window events:
//   • 'klocky:device'   { detail: DeviceInfo }  — native device + FCM token
//   • 'klocky:navigate' { detail: { route } }   — a tapped push wants a route
//   • 'klocky:push'     { detail: {...} }        — foreground push (optional)
//
// We register the device with the backend once the user is authenticated, post
// a `loggedIn` message back to RN after login, and route on push taps. Every
// network call is best-effort — a normal browser session is unaffected.
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceInfo {
  deviceId: string;
  platform: string;
  fcmToken: string;
}

type MobileWindow = Window & {
  __IS_MOBILE__?: boolean;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};

@Injectable({ providedIn: 'root' })
export class MobileBridgeService {

  private readonly api = inject(ApiService);
  private readonly appState = inject(AppStateService);
  private readonly attendance = inject(AttendanceStateService);
  private readonly router = inject(Router);

  private device?: DeviceInfo;
  private started = false;

  get isMobile(): boolean { return !!(window as MobileWindow).__IS_MOBILE__; }
  get deviceId(): string | undefined { return this.device?.deviceId; }

  /** Call ONCE at app start (AppComponent) so the window listeners attach. */
  init(): void {
    if (this.started || !this.isMobile) return;
    this.started = true;

    window.addEventListener('klocky:device', (e: Event) => {
      const detail = (e as CustomEvent<DeviceInfo>).detail;
      if (!detail) return;
      this.device = detail;
      // Device info can arrive after login completed — register straight away.
      if (this.appState.isAuthenticated()) this.register();
    });

    window.addEventListener('klocky:navigate', (e: Event) => {
      const route = (e as CustomEvent<{ route?: string }>).detail?.route;
      if (route) this.router.navigateByUrl(route);
    });

    // Foreground data pushes. Most notification content already reflects via
    // SignalR, but two data-message types need explicit handling:
    //   • 'geofence'       — silent: re-hydrate the native geofence config.
    //   • 'clockOutStatus' — show an in-app toast (e.g. auto clock-out result).
    window.addEventListener('klocky:push', (e: Event) => {
      const data = (e as CustomEvent<{ type?: string; message?: string }>).detail;
      if (!data?.type) return;
      if (data.type === 'geofence') {
        this.hydrateGeofence();
      } else if (data.type === 'clockOutStatus') {
        this.attendance.showToast(data.message ?? 'You have been clocked out.', 'info');
      }
    });
  }

  /** Call right after a successful login (tokens already stored). */
  onLogin(): void {
    if (!this.isMobile) return;
    (window as MobileWindow).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'loggedIn' }));
    // If the device handshake already happened, register now; otherwise the
    // 'klocky:device' listener will register as soon as it arrives.
    if (this.device) this.register();
    // Push the current geofence config down to the native layer.
    this.hydrateGeofence();
  }

  private register(): void {
    if (!this.device) return;
    // Bearer token is attached by authInterceptor automatically.
    this.api.post('/mobile/register-device', this.device).subscribe({ error: () => { /* best-effort */ } });
  }

  /**
   * Fetch the caller's geofence config and forward it to the RN shell so the
   * native layer can (re)arm the geofence. Best-effort; no-op off mobile.
   */
  hydrateGeofence(): void {
    if (!this.isMobile) return;
    this.attendance.getGeofenceConfig().subscribe({
      next: (res) => {
        (window as MobileWindow).ReactNativeWebView?.postMessage(
          JSON.stringify({ type: 'geofence', config: res.data }),
        );
      },
      error: () => { /* best-effort */ },
    });
  }
}
