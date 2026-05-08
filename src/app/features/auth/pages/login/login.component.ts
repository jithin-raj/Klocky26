import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { OrgLookupComponent } from '../../components/org-lookup/org-lookup.component';
import { EmailStepComponent } from '../../components/email-step/email-step.component';
import { AuthStateService } from '../../services/auth-state.service';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { DEMO_THEME_SLUGS } from '../../../../core/config/org-themes.const';

// ── API integration reference ──────────────────────────────────────────────
// When wiring real login:
//
//   private authService = inject(AuthService);   // core/services/auth.service.ts
//   private appState    = inject(AppStateService); // core/services/app-state.service.ts
//
//   // Replace onLoggedIn() with:
//   onLoggedIn(): void {
//     const payload: LoginRequest = {
//       email:   this.authState.email(),
//       password: this.password,        // from EmailStepComponent @Output
//       orgSlug: this.authState.orgIdentifier(),
//     };
//     this.authService.login(payload).subscribe({
//       next: () => {
//         this.loginSuccess = true;
//         setTimeout(() => this.router.navigate(['/app/dashboard']), 1400);
//       },
//       error: (err) => this.error = err.error?.message ?? 'Login failed',
//     });
//   }
// ──────────────────────────────────────────────────────────────────────────────

type LoginStep = 'org' | 'credentials' | 'loading';

@Component({
  selector: 'klocky-login',
  standalone: true,
  imports: [AuthShellComponent, OrgLookupComponent, EmailStepComponent],
  template: `
    <klocky-auth-shell
      [orgName]="authState.orgDisplayName()"
      [isSuccess]="loginSuccess"
    >
      @switch (step) {
        @case ('org') {
          <klocky-org-lookup (found)="step = 'credentials'" (register)="goRegister()" />
        }
        @case ('credentials') {
          <klocky-email-step (loggedIn)="onLoggedIn()" (back)="onBack()" />
        }
        @case ('loading') {
          <div class="login-loading">
            <div class="login-loading-spinner"></div>
            <h2 class="login-loading-title">Welcome back!</h2>
            <p class="login-loading-text">Setting up your workspace...</p>
          </div>
        }
      }
    </klocky-auth-shell>
  `,
  styles: [`
    :host { display: block; height: 100dvh; overflow: hidden; }
    
    .login-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 40px 20px;
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .login-loading-spinner {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-loading-title {
      font-size: 24px;
      font-weight: 800;
      color: #fff;
      margin: 0;
      letter-spacing: -0.5px;
    }

    .login-loading-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
    }
  `],
})
export class LoginComponent implements OnInit {
  step: LoginStep = 'org';
  loginSuccess = false;

  readonly authState = inject(AuthStateService);
  private router    = inject(Router);
  private orgTheme  = inject(OrgThemeService);
  private appState  = inject(AppStateService);

  ngOnInit(): void {
    this.orgTheme.reset();
  }

  onBack(): void {
    if (this.step === 'credentials' || this.step === 'loading') {
      this.authState.resetToOrgStep();
      this.orgTheme.reset();
      this.step = 'org';
    }
  }

  async onLoggedIn(): Promise<void> {
    // Show loading screen
    this.step = 'loading';
    const randomSlug = DEMO_THEME_SLUGS[Math.floor(Math.random() * DEMO_THEME_SLUGS.length)];
    
    // ── Demo session — replace with real API call when backend is ready ──
    await this.appState.patch({
      accessToken:  'demo-token',
      refreshToken: 'demo-refresh',
      expiresAt:    Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      orgSlug:      this.authState.orgIdentifier() || 'demo',
      user: {
        id:        'demo-user',
        firstName: 'Demo',
        lastName:  'User',
        email:     this.authState.email() || 'demo@klocky.app',
        role:      'admin',
        orgId:     'demo-org',
        orgSlug:   this.authState.orgIdentifier() || 'demo',
        isActive:  true,
        createdAt: new Date().toISOString(),
      },
    });
    // ─────────────────────────────────────────────────────────────────────

    // Show loading state for 2 seconds before navigating
    await this.delay(2000);
    this.loginSuccess = true;
    await this.delay(600);
    
    // Navigate to org-scoped dashboard
    const orgSlug = this.authState.orgIdentifier() || 'demo';
    await this.router.navigate([`/${orgSlug}/app/dashboard`]); 
    this.orgTheme.apply(randomSlug);
  }

  goRegister(): void {
    this.router.navigate(['/free-trial']);
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

