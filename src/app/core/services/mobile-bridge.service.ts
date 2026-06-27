import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AppStateService } from './app-state.service';

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

    // Foreground pushes already reflect in the UI via SignalR, so we don't
    // re-handle 'klocky:push' here to avoid duplicate notifications.
  }

  /** Call right after a successful login (tokens already stored). */
  onLogin(): void {
    if (!this.isMobile) return;
    (window as MobileWindow).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'loggedIn' }));
    // If the device handshake already happened, register now; otherwise the
    // 'klocky:device' listener will register as soon as it arrives.
    if (this.device) this.register();
  }

  private register(): void {
    if (!this.device) return;
    // Bearer token is attached by authInterceptor automatically.
    this.api.post('/mobile/register-device', this.device).subscribe({ error: () => { /* best-effort */ } });
  }
}
