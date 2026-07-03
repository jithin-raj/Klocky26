import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconKlockyLogoComponent } from '../../../../shared/icons/icon-klocky-logo.component';

@Component({
  selector: 'klocky-auth-shell',
  standalone: true,
  imports: [CommonModule, IconKlockyLogoComponent],
  template: `
    <div class="lk-page">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="lk-grid"></div>

      <div class="lk-split">

        <!-- ── Left brand panel (desktop only) ─────────────────── -->
        <div class="lk-left">
          <div class="lk-ll-brand">
            <div class="lk-logo-mark">
              <icon-klocky-logo [size]="32"></icon-klocky-logo>
            </div>
            <span class="lk-ll-name">klock</span>
          </div>

          <div class="lk-ll-body">
            <div class="lk-eyebrow-tag">
              <span class="lk-badge-dot"></span>
              Attendance &amp; HR Platform
            </div>
            <h2 class="lk-ll-heading">Smart attendance.<br>Effortless HR.</h2>
            <p class="lk-ll-sub">
              Clock in/out in seconds, manage leave, and understand your team — all from one platform.
            </p>
          </div>

          <ul class="lk-feats">
            <li>
              <span class="lk-feat-ic">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </span>
              Real-time clock in / out
            </li>
            <li>
              <span class="lk-feat-ic">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              Leave &amp; absence management
            </li>
            <li>
              <span class="lk-feat-ic">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              Employee profiles &amp; teams
            </li>
            <li>
              <span class="lk-feat-ic">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </span>
              Insights &amp; analytics
            </li>
          </ul>

          <p class="lk-ll-tagline">Trusted by growing teams worldwide</p>
        </div>

        <!-- ── Right form panel ────────────────────────────────── -->
        <div class="lk-right">
          <div class="lk-card" [class.is-success]="isSuccess">

            <!-- Brand shown in card on mobile (hidden on desktop) -->
            <div class="lk-brand">
              <div class="lk-logo-mark">
                <icon-klocky-logo [size]="28"></icon-klocky-logo>
              </div>
              @if (orgName) {
                <span class="lk-logo-name lk-logo-org">{{ orgName }}<span class="lk-logo-tld">.klock</span></span>
              } @else {
                <span class="lk-logo-name">klock</span>
              }
            </div>

            <ng-content />
          </div>
        </div>

      </div>

      <p class="lk-footer">© 2026 Klock · Secure login</p>
    </div>
  `,
  styleUrl: './auth-shell.component.scss',
})
export class AuthShellComponent {
  @Input() orgName = '';
  @Input() isSuccess = false;
}
