import { Component, ChangeDetectionStrategy, signal, computed, HostListener, OnInit } from '@angular/core';

// ─────────────────────────────────────────────────────────────────────────────
// OfflineModalComponent — global "no internet connection" overlay.
//
// Mounted once at the app root (app.component.html), so it covers every area:
// the org app AND the Klock platform admin. Listens to the browser's
// online/offline events; shows an animated glass modal while offline and a
// brief "Back online" flash when the connection returns.
//
// Theme-neutral dark glass so it reads well on both the light org app and the
// dark admin shell. Picks up --accent when a theme sets it.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'klocky-offline-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="om" [class.om--ok]="justReconnected()">
        <div class="om__backdrop"></div>

        <!-- Drifting particles for depth -->
        <div class="om__particles" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>

        <div class="om__card" [class.om__shake]="shake()" role="alertdialog" aria-live="assertive">
          @if (justReconnected()) {
            <!-- ── Reconnected flash ── -->
            <div class="om__icon om__icon--ok">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" class="om__tick"/>
              </svg>
            </div>
            <h2 class="om__title">Back online</h2>
            <p class="om__msg">Your connection has been restored.</p>
          } @else {
            <!-- ── Offline ── -->
            <div class="om__icon">
              <span class="om__wave om__wave--1"></span>
              <span class="om__wave om__wave--2"></span>
              <span class="om__wave om__wave--3"></span>
              <span class="om__orbit"><i></i></span>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
                <line x1="2" y1="2" x2="22" y2="22" class="om__slash"/>
              </svg>
            </div>

            <h2 class="om__title">You're offline</h2>
            <p class="om__msg">
              We can't reach Klockk right now. Check your internet connection —
              we'll reconnect automatically the moment you're back.
            </p>

            <div class="om__dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>

            <button class="om__btn" type="button" [disabled]="checking()" (click)="retry()">
              @if (checking()) { <span class="om__spinner"></span> Checking… }
              @else { Try again }
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .om {
      position: fixed; inset: 0; z-index: 20000;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      --om-accent: var(--accent, #6366f1);
    }
    .om__backdrop {
      position: absolute; inset: 0;
      background: rgba(6, 10, 20, 0.62);
      backdrop-filter: blur(8px);
      animation: om-fade .3s ease both;
    }

    .om__card {
      position: relative;
      width: 100%; max-width: 420px;
      padding: 34px 30px 28px;
      text-align: center;
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(24, 30, 46, .96), rgba(15, 20, 34, .97));
      border: 1px solid rgba(255,255,255,.09);
      box-shadow: 0 30px 80px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.03) inset;
      color: #fff;
      animation: om-pop .42s cubic-bezier(.16, 1, .3, 1) both;
    }
    .om__shake { animation: om-shake .45s cubic-bezier(.36,.07,.19,.97) both; }

    /* ── Icon + signal waves ── */
    .om__icon {
      position: relative;
      width: 84px; height: 84px; margin: 0 auto 20px;
      display: grid; place-items: center;
      border-radius: 50%;
      color: #fca5a5;
      background: radial-gradient(circle at 50% 45%, rgba(239,68,68,.22), rgba(239,68,68,.06) 70%);
      box-shadow: inset 0 0 0 1px rgba(239,68,68,.28);
    }
    .om__icon svg { position: relative; z-index: 2; animation: om-float 3s ease-in-out infinite; }
    .om__slash { color: #f87171; stroke: currentColor; animation: om-slash .5s ease .2s both; }

    .om__wave {
      position: absolute; inset: 0; margin: auto;
      width: 84px; height: 84px; border-radius: 50%;
      border: 2px solid rgba(239,68,68,.4);
      opacity: 0;
      animation: om-wave 2.6s ease-out infinite;
    }
    .om__wave--2 { animation-delay: .6s; }
    .om__wave--3 { animation-delay: 1.2s; }

    /* Orbiting satellite around the icon */
    .om__orbit { position: absolute; inset: -7px; border-radius: 50%; animation: om-orbit 3.2s linear infinite; }
    .om__orbit i {
      position: absolute; top: -4px; left: 50%; margin-left: -4px;
      width: 8px; height: 8px; border-radius: 50%;
      background: #fca5a5; box-shadow: 0 0 10px #f87171;
    }
    .om--ok .om__orbit i { background: #6ee7b7; box-shadow: 0 0 10px #34d399; }
    @keyframes om-orbit { to { transform: rotate(360deg); } }

    /* Drifting particles for depth */
    .om__particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    .om__particles span {
      position: absolute; bottom: -12px; width: 7px; height: 7px; border-radius: 50%;
      background: var(--om-accent); opacity: .3; animation: om-rise linear infinite;
    }
    .om__particles span:nth-child(1) { left: 14%; width: 6px; height: 6px; animation-duration: 9s;  animation-delay: 0s; }
    .om__particles span:nth-child(2) { left: 32%; width: 9px; height: 9px; animation-duration: 12s; animation-delay: 1.4s; }
    .om__particles span:nth-child(3) { left: 50%; width: 5px; height: 5px; animation-duration: 8s;  animation-delay: .6s; }
    .om__particles span:nth-child(4) { left: 66%; width: 8px; height: 8px; animation-duration: 11s; animation-delay: 2.2s; }
    .om__particles span:nth-child(5) { left: 82%; width: 6px; height: 6px; animation-duration: 10s; animation-delay: .9s; }
    .om__particles span:nth-child(6) { left: 92%; width: 4px; height: 4px; animation-duration: 13s; animation-delay: 3s; }
    @keyframes om-rise {
      0%   { transform: translateY(0) scale(1);   opacity: 0; }
      12%  { opacity: .5; }
      100% { transform: translateY(-102vh) scale(.35); opacity: 0; }
    }

    .om__icon--ok {
      color: #6ee7b7;
      background: radial-gradient(circle at 50% 45%, rgba(16,185,129,.25), rgba(16,185,129,.06) 70%);
      box-shadow: inset 0 0 0 1px rgba(16,185,129,.3);
    }
    .om__tick { stroke-dasharray: 26; stroke-dashoffset: 26; animation: om-draw .5s ease .1s forwards; }

    .om__title { margin: 0 0 8px; font-size: 21px; font-weight: 800; letter-spacing: -.3px; }
    .om__msg { margin: 0 auto; max-width: 320px; font-size: 13.5px; line-height: 1.6; color: rgba(255,255,255,.62); }

    /* ── Bouncing dots ── */
    .om__dots { display: flex; gap: 7px; justify-content: center; margin: 20px 0 22px; }
    .om__dots span {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--om-accent);
      animation: om-bounce 1.3s ease-in-out infinite;
    }
    .om__dots span:nth-child(2) { animation-delay: .18s; }
    .om__dots span:nth-child(3) { animation-delay: .36s; }

    /* ── Button ── */
    .om__btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-width: 150px; padding: 12px 24px;
      border: none; border-radius: 12px; cursor: pointer;
      font-size: 14px; font-weight: 700; color: #fff; font-family: inherit;
      background: linear-gradient(135deg, color-mix(in srgb, var(--om-accent) 82%, #fff 4%), var(--om-accent));
      box-shadow: 0 8px 22px -6px color-mix(in srgb, var(--om-accent) 70%, transparent);
      transition: filter .15s, transform .1s;
    }
    .om__btn:hover:not(:disabled) { filter: brightness(1.08); }
    .om__btn:active:not(:disabled) { transform: translateY(1px); }
    .om__btn:disabled { opacity: .75; cursor: default; }

    .om__spinner {
      width: 15px; height: 15px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: om-spin .7s linear infinite;
    }

    /* ── Keyframes ── */
    @keyframes om-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes om-pop {
      from { opacity: 0; transform: translateY(16px) scale(.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes om-shake {
      10%,90% { transform: translateX(-1px); }
      20%,80% { transform: translateX(2px); }
      30%,50%,70% { transform: translateX(-5px); }
      40%,60% { transform: translateX(5px); }
    }
    @keyframes om-wave {
      0%   { opacity: .55; transform: scale(1); }
      100% { opacity: 0;   transform: scale(1.9); }
    }
    @keyframes om-float {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-5px); }
    }
    @keyframes om-slash {
      from { stroke-dasharray: 30; stroke-dashoffset: 30; }
      to   { stroke-dasharray: 30; stroke-dashoffset: 0; }
    }
    @keyframes om-draw { to { stroke-dashoffset: 0; } }
    @keyframes om-bounce {
      0%,100% { transform: translateY(0); opacity: .5; }
      40%     { transform: translateY(-9px); opacity: 1; }
    }
    @keyframes om-spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      .om__icon svg, .om__wave, .om__dots span, .om__card, .om__backdrop,
      .om__orbit, .om__particles span { animation: none; }
      .om__particles { display: none; }
    }
  `],
})
export class OfflineModalComponent implements OnInit {
  readonly online = signal(true);
  readonly justReconnected = signal(false);
  readonly checking = signal(false);
  readonly shake = signal(false);

  /** Show while offline, or during the brief "back online" confirmation flash. */
  readonly show = computed(() => !this.online() || this.justReconnected());

  ngOnInit(): void {
    if (typeof navigator !== 'undefined') this.online.set(navigator.onLine);
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.justReconnected.set(false);
    this.online.set(false);
  }

  @HostListener('window:online')
  onOnline(): void {
    this.online.set(true);
    this.flashReconnected();
  }

  retry(): void {
    if (this.checking()) return;
    this.checking.set(true);
    // navigator.onLine is the authoritative in-browser signal.
    setTimeout(() => {
      this.checking.set(false);
      if (typeof navigator === 'undefined' || navigator.onLine) {
        this.online.set(true);
        this.flashReconnected();
      } else {
        this.shake.set(true);
        setTimeout(() => this.shake.set(false), 500);
      }
    }, 650);
  }

  private flashReconnected(): void {
    this.justReconnected.set(true);
    setTimeout(() => this.justReconnected.set(false), 1600);
  }
}
