import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrgThemeService } from '../../../core/services/org-theme.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { ToastService } from '../../components/ui-toast/toast.service';

@Component({
  selector: 'klocky-not-found',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="not-found" 
         [style.background]="pageBackground()" 
         [style.color]="textColor()">
      <!-- Animated background grid -->
      <div class="grid-bg"></div>
      
      <!-- Gradient overlay -->
      <div class="gradient-overlay"></div>

      <!-- Rotating aurora glow -->
      <div class="aurora"></div>

      <div class="not-found-container">
        <!-- Glitch effect wrapper -->
        <div class="glitch-wrapper">
          <!-- Animated 404 with glitch effect -->
          <div class="not-found-number" data-text="404">
            <span class="digit" data-digit="4">4</span>
            <span class="zero-wrap">
              <span class="orbit"><i class="orbit-dot"></i></span>
              <span class="digit middle" data-digit="0">0</span>
              <!-- The zero doubles as a ticking clock (Klock ⏱) -->
              <span class="clock" aria-hidden="true">
                <i class="clock-tick clock-tick--12"></i>
                <i class="clock-tick clock-tick--3"></i>
                <i class="clock-tick clock-tick--6"></i>
                <i class="clock-tick clock-tick--9"></i>
                <i class="clock-hand clock-hand--hour"></i>
                <i class="clock-hand clock-hand--min"></i>
                <i class="clock-hand clock-hand--sec"></i>
                <i class="clock-center"></i>
              </span>
            </span>
            <span class="digit" data-digit="4">4</span>
          </div>
        </div>

        <!-- Message with fade-in animation -->
        <div class="message-container">
          <h1 class="not-found-title">{{ getTitle() }}</h1>
          <p class="not-found-message">
            {{ getMessage() }}
          </p>
        </div>

        <!-- Actions with hover effects -->
        <div class="not-found-actions">
          <button class="btn btn-primary" (click)="goHome()"
                  [style.background]="buttonBg()"
                  [style.color]="buttonTextColor()"
                  [style.border-color]="buttonBg()">
            <span class="btn-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              @if (!isAuthenticated()) {
                Go to Home
              } @else if (needsSubscription()) {
                {{ canManageBilling() ? 'Complete Subscription' : 'Got it' }}
              } @else {
                Go to Dashboard
              }
            </span>
          </button>
        </div>

        <!-- Elegant decorative elements -->
        <div class="not-found-decoration">
          <!-- Floating particles -->
          <div class="particle particle-1"></div>
          <div class="particle particle-2"></div>
          <div class="particle particle-3"></div>
          <div class="particle particle-4"></div>
          <div class="particle particle-5"></div>
          
          <!-- Geometric shapes -->
          <div class="shape shape-1"></div>
          <div class="shape shape-2"></div>
          <div class="shape shape-3"></div>

          <!-- Twinkling stars -->
          <div class="twinkle twinkle-1"></div>
          <div class="twinkle twinkle-2"></div>
          <div class="twinkle twinkle-3"></div>
          <div class="twinkle twinkle-4"></div>
          <div class="twinkle twinkle-5"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }

    .not-found {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      padding: 20px;
    }

    /* Animated grid background */
    .grid-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        linear-gradient(currentColor 1px, transparent 1px),
        linear-gradient(90deg, currentColor 1px, transparent 1px);
      background-size: 50px 50px;
      opacity: 0.08;
      animation: gridMove 20s linear infinite;
      z-index: 0;
    }

    @keyframes gridMove {
      0% { transform: translate(0, 0); }
      100% { transform: translate(50px, 50px); }
    }

    /* Gradient overlay for depth */
    .gradient-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.15) 100%);
      z-index: 1;
    }

    /* Rotating aurora glow behind the content */
    .aurora {
      position: absolute;
      width: 720px; height: 720px;
      top: 50%; left: 50%;
      border-radius: 45% 55% 52% 48%;
      background: conic-gradient(from 0deg,
        rgba(255,255,255,.20), rgba(255,255,255,0) 30%,
        rgba(255,255,255,.16) 55%, rgba(255,255,255,0) 78%, rgba(255,255,255,.20));
      filter: blur(60px);
      opacity: .5;
      z-index: 1;
      transform: translate(-50%, -50%);
      animation: auroraSpin 18s linear infinite;
      pointer-events: none;
      mix-blend-mode: soft-light;
    }

    @keyframes auroraSpin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    /* Orbit ring around the middle 0 */
    .zero-wrap { position: relative; display: inline-grid; place-items: center; }
    .orbit {
      position: absolute;
      width: 165px; height: 165px;
      border: 1.5px dashed currentColor;
      border-radius: 50%;
      opacity: .35;
      animation: orbitSpin 12s linear infinite;
    }
    .orbit-dot {
      position: absolute; top: -5px; left: 50%;
      width: 10px; height: 10px; margin-left: -5px;
      background: currentColor; border-radius: 50%;
      box-shadow: 0 0 14px 2px currentColor;
    }
    @keyframes orbitSpin { to { transform: rotate(360deg); } }

    /* ── The zero as a ticking clock ──
       .clock is a sibling of .digit.middle (the "0" text), not a child of it —
       so it needs the SAME float animation + delay applied here, otherwise the
       "0" bounces via digitFloat on .digit while the clock overlay stays put,
       visibly detaching from the digit it's supposed to sit inside. */
    .clock {
      position: absolute; inset: 0; z-index: 4;
      pointer-events: none;
      animation: digitFloat 3s ease-in-out infinite;
      animation-delay: 0.15s;
    }
    .clock-hand {
      position: absolute; left: 50%; bottom: 50%;
      transform-origin: bottom center;
      border-radius: 6px; background: currentColor;
      box-shadow: 0 0 10px currentColor;
    }
    .clock-hand--hour { width: 6px; height: 30px; opacity: .95;
      animation: clockSpin 24s linear infinite; }
    .clock-hand--min  { width: 4px; height: 44px; opacity: .8;
      animation: clockSpin 8s linear infinite; }
    .clock-hand--sec  { width: 2px; height: 50px;
      background: #fff; box-shadow: 0 0 12px #fff;
      animation: clockSpin 3s steps(30, end) infinite; }
    .clock-center {
      position: absolute; left: 50%; top: 50%;
      width: 12px; height: 12px; margin: -6px 0 0 -6px;
      border-radius: 50%; background: #fff;
      box-shadow: 0 0 12px rgba(255,255,255,.9);
    }
    .clock-tick {
      position: absolute; left: 50%; top: 50%;
      width: 4px; height: 10px; margin-left: -2px;
      background: currentColor; opacity: .5; border-radius: 3px;
      transform-origin: 50% 0;
    }
    .clock-tick--12 { transform: translateY(-46px); }
    .clock-tick--6  { transform: rotate(180deg) translateY(-46px); }
    .clock-tick--3  { transform: rotate(90deg) translateY(-46px); }
    .clock-tick--9  { transform: rotate(-90deg) translateY(-46px); }

    @keyframes clockSpin {
      from { transform: translateX(-50%) rotate(0deg); }
      to   { transform: translateX(-50%) rotate(360deg); }
    }

    /* ── Twinkling stars ── */
    .twinkle {
      position: absolute; z-index: 1; border-radius: 50%;
      background: currentColor; box-shadow: 0 0 6px currentColor;
      animation: twinkle 3.5s ease-in-out infinite;
    }
    .twinkle-1 { width: 4px; height: 4px; top: 18%; left: 30%; animation-delay: 0s; }
    .twinkle-2 { width: 3px; height: 3px; top: 28%; right: 26%; animation-delay: .8s; }
    .twinkle-3 { width: 5px; height: 5px; bottom: 26%; left: 34%; animation-delay: 1.6s; }
    .twinkle-4 { width: 3px; height: 3px; bottom: 32%; right: 32%; animation-delay: 2.3s; }
    .twinkle-5 { width: 4px; height: 4px; top: 42%; left: 20%; animation-delay: 1.1s; }
    @keyframes twinkle {
      0%, 100% { opacity: 0; transform: scale(.4); }
      50%      { opacity: .9; transform: scale(1.15); }
    }

    @media (prefers-reduced-motion: reduce) {
      .aurora, .orbit, .grid-bg, .digit, .digit::before,
      .particle, .shape, .clock, .clock-hand, .twinkle { animation: none !important; }
    }

    .not-found-container {
      position: relative;
      z-index: 2;
      text-align: center;
      max-width: 700px;
      width: 100%;
      animation: containerFadeIn 1s ease-out;
    }

    @keyframes containerFadeIn {
      from { 
        opacity: 0;
        transform: translateY(30px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Glitch wrapper for 404 */
    .glitch-wrapper {
      position: relative;
      margin-bottom: 48px;
    }

    .not-found-number {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      perspective: 1200px;
      position: relative;
    }

    .digit {
      font-size: 140px;
      font-weight: 900;
      background: linear-gradient(180deg, currentColor 0%, currentColor 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      position: relative;
      line-height: 1;
      letter-spacing: -0.05em;
      animation: digitFloat 3s ease-in-out infinite;
      filter: drop-shadow(0 0 20px currentColor)
              drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
      opacity: 0.95;
    }

    .digit::before {
      content: attr(data-digit);
      position: absolute;
      top: 0;
      left: 0;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: digitGlitch 5s infinite;
    }

    .digit.middle {
      font-size: 160px;
      animation-delay: 0.15s;
      margin: 0 -10px;
    }

    .digit:first-child {
      animation-delay: 0s;
    }

    .digit:last-child {
      animation-delay: 0.3s;
    }

    @keyframes digitFloat {
      0%, 100% { 
        transform: translateY(0px) rotateY(0deg);
      }
      50% { 
        transform: translateY(-15px) rotateY(5deg);
      }
    }

    @keyframes digitGlitch {
      0%, 90%, 100% {
        transform: translate(0, 0);
        opacity: 0;
      }
      91% {
        transform: translate(2px, -2px);
        opacity: 0.7;
      }
      92% {
        transform: translate(-2px, 2px);
        opacity: 0.5;
      }
      93% {
        transform: translate(0, 0);
        opacity: 0;
      }
    }

    /* Message container with fade-in */
    .message-container {
      margin-bottom: 48px;
      animation: messageFadeIn 1s ease-out 0.3s both;
    }

    @keyframes messageFadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .not-found-title {
      font-size: 42px;
      font-weight: 800;
      color: currentColor;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      line-height: 1.2;
    }

    .not-found-message {
      font-size: 18px;
      color: currentColor;
      opacity: 0.9;
      margin: 0;
      line-height: 1.7;
      max-width: 500px;
      margin: 0 auto;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-weight: 400;
    }

    /* Enhanced buttons */
    .not-found-actions {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
      animation: actionsFadeIn 1s ease-out 0.6s both;
    }

    @keyframes actionsFadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      z-index: 10;
    }

    .btn-content {
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      z-index: 1;
    }

    .btn-primary {
      border: 2px solid;
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.15),
        0 4px 12px rgba(0, 0, 0, 0.1);
      font-weight: 700;
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 
        0 12px 32px rgba(0, 0, 0, 0.25),
        0 6px 16px rgba(0, 0, 0, 0.15);
      filter: brightness(1.1);
    }

    .btn:active {
      transform: translateY(-1px);
    }

    .btn svg {
      transition: transform 0.3s ease;
    }

    .btn:hover svg {
      transform: translateX(3px);
    }

    /* Elegant decorative elements */
    .not-found-decoration {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
    }

    /* Floating particles */
    .particle {
      position: absolute;
      width: 3px;
      height: 3px;
      background: currentColor;
      opacity: 0.5;
      border-radius: 50%;
      box-shadow: 0 0 8px currentColor;
      animation: particleFloat 6s ease-in-out infinite;
    }

    .particle-1 {
      top: 20%;
      left: 15%;
      animation-delay: 0s;
      animation-duration: 5s;
    }

    .particle-2 {
      top: 60%;
      right: 20%;
      animation-delay: 1s;
      animation-duration: 7s;
    }

    .particle-3 {
      bottom: 25%;
      left: 25%;
      animation-delay: 2s;
      animation-duration: 6s;
    }

    .particle-4 {
      top: 40%;
      right: 10%;
      animation-delay: 3s;
      animation-duration: 8s;
    }

    .particle-5 {
      bottom: 40%;
      left: 8%;
      animation-delay: 1.5s;
      animation-duration: 5.5s;
    }

    @keyframes particleFloat {
      0%, 100% {
        transform: translate(0, 0) scale(1);
        opacity: 0.3;
      }
      25% {
        transform: translate(20px, -30px) scale(1.2);
        opacity: 0.7;
      }
      50% {
        transform: translate(-15px, -60px) scale(1.5);
        opacity: 1;
      }
      75% {
        transform: translate(30px, -30px) scale(1.2);
        opacity: 0.7;
      }
    }

    /* Geometric shapes */
    .shape {
      position: absolute;
      border: 1px solid currentColor;
      opacity: 0.15;
      border-radius: 12px;
      backdrop-filter: blur(5px);
    }

    .shape-1 {
      width: 150px;
      height: 150px;
      top: 10%;
      right: 8%;
      animation: shapeRotate 20s linear infinite;
      transform-origin: center;
    }

    .shape-2 {
      width: 100px;
      height: 100px;
      bottom: 15%;
      left: 10%;
      animation: shapeRotate 25s linear infinite reverse;
      transform-origin: center;
    }

    .shape-3 {
      width: 80px;
      height: 80px;
      top: 50%;
      left: 5%;
      animation: shapeFloat 8s ease-in-out infinite;
    }

    @keyframes shapeRotate {
      from {
        transform: rotate(0deg);
        opacity: 0.1;
      }
      50% {
        opacity: 0.3;
      }
      to {
        transform: rotate(360deg);
        opacity: 0.1;
      }
    }

    @keyframes shapeFloat {
      0%, 100% {
        transform: translate(0, 0) rotate(0deg);
        opacity: 0.2;
      }
      50% {
        transform: translate(30px, -30px) rotate(45deg);
        opacity: 0.4;
      }
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .digit {
        font-size: 100px;
      }

      .digit.middle {
        font-size: 120px;
        margin: 0 -8px;
      }

      .not-found-title {
        font-size: 32px;
      }

      .not-found-message {
        font-size: 16px;
        padding: 0 10px;
      }

      .btn {
        padding: 14px 26px;
        font-size: 15px;
      }

      .shape {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .digit {
        font-size: 70px;
      }

      .digit.middle {
        font-size: 90px;
        margin: 0 -5px;
      }

      .not-found-title {
        font-size: 26px;
      }

      .not-found-message {
        font-size: 15px;
      }

      .not-found-actions {
        flex-direction: column;
        width: 100%;
        gap: 12px;
      }

      .btn {
        width: 100%;
        justify-content: center;
        padding: 14px 24px;
      }

      .not-found-number {
        gap: 8px;
      }
    }
  `]
})
export class NotFoundComponent implements OnInit {
  private router = inject(Router);
  private orgTheme = inject(OrgThemeService);
  private appState = inject(AppStateService);
  private subscription = inject(SubscriptionService);
  private toast = inject(ToastService);

  constructor() {
    // Load theme from storage on component init
    const storedTheme = localStorage.getItem('klocky_org_slug');
    if (storedTheme) {
      if (storedTheme.startsWith('custom:')) {
        const accentColor = storedTheme.substring(7);
        const theme = this.orgTheme.generateThemeFromColor(accentColor);
        this.orgTheme.apply(theme);
      } else {
        this.orgTheme.apply(storedTheme);
      }
    } else {
      // No stored theme, ensure default is applied
      this.orgTheme.apply('default');
    }
  }

  ngOnInit(): void {
    // Check authentication after component is initialized and rendered
    // Immediately redirect if not authenticated - don't show 404 to unauthenticated users
    const isAuth = this.appState.isAuthenticated();
    console.log('404 Component - isAuthenticated:', isAuth);
    
    if (!isAuth) {
      console.log('Redirecting to landing page...');
      this.router.navigate(['/'], { replaceUrl: true });
    }
  }

  // Get colors from org theme - use signal directly for reactivity
  accentColor = computed(() => {
    const theme = this.orgTheme.theme();
    return theme?.accent || '#667eea';
  });

  accentDark = computed(() => {
    const theme = this.orgTheme.theme();
    return theme?.accentDark || '#764ba2';
  });

  // Adaptive background for light/dark themes
  pageBackground = computed(() => {
    const accent = this.accentColor();
    const accentDark = this.accentDark();
    
    // Always use the accent gradient - text color will adapt
    return `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`;
  });

  // Adaptive text color
  textColor = computed(() => {
    const accent = this.accentColor();
    const luminance = this._getLuminance(accent);
    // Use dark text for light backgrounds (luminance > 0.5)
    return luminance > 0.5 ? '#1e293b' : '#ffffff';
  });

  // Button background color (contrasts with page background)
  buttonBg = computed(() => {
    const accent = this.accentColor();
    const luminance = this._getLuminance(accent);
    // For light themes (white/light accents), use dark button; for dark themes, use white button
    return luminance > 0.5 ? '#1e293b' : '#ffffff';
  });

  // Button text color (contrasts with button background)
  buttonTextColor = computed(() => {
    const accent = this.accentColor();
    const luminance = this._getLuminance(accent);
    // Button bg logic: light accent -> dark bg, dark accent -> white bg
    // So: light accent -> white text (on dark bg), dark accent -> dark text (on white bg)
    return luminance > 0.5 ? '#ffffff' : '#1e293b';
  });

  isAuthenticated = computed(() => this.appState.isAuthenticated());

  /** Authenticated but the org's subscription is expired. */
  needsSubscription = computed(() => this.isAuthenticated() && this.subscription.isExpired());

  /**
   * /billing is role-gated (roleGuard: admin/hr/super_admin only) — sending
   * anyone else there gets bounced straight back to /404 by that guard, which
   * looks like "the button does nothing". So only admins/HR get the
   * "Complete Subscription" CTA that navigates there; everyone else sees an
   * informational message instead (same split as the trial banner).
   */
  canManageBilling = computed(() => {
    const u = this.appState.user();
    return !!(u?.isAdmin || u?.isHr || u?.role === 'super_admin');
  });

  private _getLuminance(hex: string): number {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  getTitle(): string {
    return this.needsSubscription() ? 'Subscription Required' : 'Page Not Found';
  }

  getMessage(): string {
    if (this.needsSubscription()) {
      return this.canManageBilling()
        ? "Your organisation's subscription has expired. Complete your subscription to keep using Klock."
        : "Your organisation's subscription has expired. Ask your administrator to renew — access is locked until then.";
    }
    return "The page you're looking for doesn't exist or has been moved.";
  }

  goHome(): void {
    const orgUrlName = this.appState.orgUrlName();
    if (orgUrlName && this.appState.isAuthenticated()) {
      if (this.needsSubscription()) {
        if (this.canManageBilling()) {
          this.toast.error('Subscription required', 'Please complete your subscription to keep using Klock.');
          this.router.navigate([`/${orgUrlName}/app/billing`]);
        } else {
          // Non-admins can't reach /billing (roleGuard would just bounce them
          // back to /404) — there's nothing to navigate to, just remind them.
          this.toast.error('Subscription required', 'Ask your administrator to renew your organisation\'s subscription.');
        }
        return;
      }
      this.router.navigate([`/${orgUrlName}/app/dashboard`]);
    } else {
      // Redirect unauthenticated users to landing page
      this.router.navigate(['/']);
    }
  }
}
