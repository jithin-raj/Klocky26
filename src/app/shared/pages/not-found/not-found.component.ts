import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrgThemeService } from '../../../core/services/org-theme.service';
import { AppStateService } from '../../../core/services/app-state.service';

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

      <div class="not-found-container">
        <!-- Glitch effect wrapper -->
        <div class="glitch-wrapper">
          <!-- Animated 404 with glitch effect -->
          <div class="not-found-number" data-text="404">
            <span class="digit" data-digit="4">4</span>
            <span class="digit middle" data-digit="0">0</span>
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
              {{ isAuthenticated() ? 'Go to Dashboard' : 'Go to Home' }}
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

  private _getLuminance(hex: string): number {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  getTitle(): string {
    const url = this.router.url;
    
    // // Check if URL contains wrong org slug
    // if (this.isAuthenticated() && url.includes('/') && url.split('/')[1] !== this.appState.orgSlug()) {
    //   return 'Access Denied';
    // }
    
    return 'Page Not Found';
  }

  getMessage(): string {
    const url = this.router.url;
    
    // Check if URL contains wrong org slug
    // if (this.isAuthenticated() && url.includes('/') && url.split('/')[1] !== this.appState.orgSlug()) {
    //   return "You don't have permission to access this organization's workspace. Please check the URL or contact your administrator.";
    // }
    
    // if (this.isAuthenticated()) {
    //   return "The page you're looking for doesn't exist in your organization's workspace.";
    // }
    
    return "The page you're looking for doesn't exist or has been moved.";
  }

  goHome(): void {
    const orgUrlName = this.appState.orgUrlName();
    if (orgUrlName && this.appState.isAuthenticated()) {
      this.router.navigate([`/${orgUrlName}/app/dashboard`]);
    } else {
      // Redirect unauthenticated users to landing page
      this.router.navigate(['/']);
    }
  }
}
