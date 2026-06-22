import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { OrgLookupComponent } from '../../components/org-lookup/org-lookup.component';
import { EmailStepComponent } from '../../components/email-step/email-step.component';
import { AuthStateService } from '../../services/auth-state.service';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal.component';

type LoginStep = 'org' | 'credentials' | 'loading';

@Component({
  selector: 'klocky-login',
  standalone: true,
  imports: [AuthShellComponent, OrgLookupComponent, EmailStepComponent, ReactiveFormsModule, UiModalComponent],
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

    <!-- Non-dismissible: the temp/old password was just exposed in plaintext, close the window now. -->
    <ui-modal [open]="mustChangePassword()" [closeOnBackdrop]="false">
      <div class="pwm">
        <div class="pwm-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 class="pwm-title">Set a new password</h2>
        <p class="pwm-sub">For your security, choose a new password before continuing — your temporary one won't work again.</p>

        <form [formGroup]="changePasswordForm" (ngSubmit)="submitChangePassword()">
          <div class="pwm-field">
            <label for="pwm-current">Current password</label>
            <input id="pwm-current" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                   formControlName="currentPassword" autocomplete="current-password" placeholder="Enter current password" />
          </div>
          <div class="pwm-field">
            <label for="pwm-new">New password</label>
            <input id="pwm-new" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                   formControlName="newPassword" autocomplete="new-password" placeholder="Min 8 characters" />
          </div>
          <div class="pwm-field">
            <label for="pwm-confirm">Confirm new password</label>
            <input id="pwm-confirm" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                   formControlName="confirmPassword" autocomplete="new-password" placeholder="Repeat new password" />
          </div>

          <label class="pwm-toggle-row">
            <input type="checkbox" [checked]="showPw()" (change)="showPw.set(!showPw())" />
            Show passwords
          </label>

          <div class="pwm-hints">
            <span [class.ok]="newPasswordValue().length >= 8">✓ At least 8 characters</span>
            <span [class.ok]="pwHasUpper()">✓ Uppercase letter</span>
            <span [class.ok]="pwHasNumber()">✓ Number</span>
            <span [class.ok]="pwHasSpecial()">✓ Special character</span>
          </div>

          @if (changePasswordError()) {
            <p class="pwm-error">⚠ {{ changePasswordError() }}</p>
          }

          <button class="pwm-btn" type="submit" [disabled]="changingPassword()">
            {{ changingPassword() ? 'Saving…' : 'Save & continue' }}
          </button>
        </form>
      </div>
    </ui-modal>
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

    /* ── Password-change modal — classy, org-branded (uses --accent set by OrgThemeService) ── */
    .pwm { padding: 28px 30px 30px; text-align: center; }
    .pwm-icon {
      width: 52px; height: 52px; margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: color-mix(in srgb, var(--accent, #6366f1) 12%, #fff);
      color: var(--accent, #6366f1);
    }
    .pwm-title { font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .pwm-sub { font-size: 13.5px; color: #64748b; margin: 0 0 22px; line-height: 1.5; }
    .pwm-field { display: flex; flex-direction: column; gap: 5px; text-align: left; margin-bottom: 14px; }
    .pwm-field label { font-size: 12.5px; font-weight: 600; color: #374151; }
    .pwm-input {
      padding: 10px 13px; border: 1.5px solid #e5e7eb; border-radius: 10px;
      font-size: 14px; color: #1e293b; outline: none; width: 100%; box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }
    .pwm-input:focus {
      border-color: var(--accent, #6366f1);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #6366f1) 15%, transparent);
    }
    .pwm-toggle-row {
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151;
      cursor: pointer; margin-bottom: 14px; justify-content: flex-start;
    }
    .pwm-toggle-row input { accent-color: var(--accent, #6366f1); }
    .pwm-hints {
      display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
      margin-bottom: 18px; text-align: left;
    }
    .pwm-hints span { font-size: 12px; color: #94a3b8; }
    .pwm-hints span.ok { color: #16a34a; font-weight: 600; }
    .pwm-error {
      background: #fee2e2; color: #dc2626; font-size: 13px; font-weight: 600;
      padding: 10px 14px; border-radius: 9px; margin: 0 0 14px; text-align: left;
    }
    .pwm-btn {
      width: 100%; padding: 12px; border: none; border-radius: 11px;
      background: var(--accent, #6366f1); color: #fff; font-size: 14.5px; font-weight: 700;
      cursor: pointer; transition: filter .15s, transform .1s;
    }
    .pwm-btn:hover:not(:disabled) { filter: brightness(0.92); }
    .pwm-btn:active:not(:disabled) { transform: scale(0.99); }
    .pwm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class LoginComponent implements OnInit {
  step: LoginStep = 'org';
  loginSuccess = false;

  readonly mustChangePassword = signal(false);
  readonly changingPassword = signal(false);
  readonly changePasswordError = signal('');
  readonly showPw = signal(false);
  changePasswordForm: FormGroup;

  readonly authState = inject(AuthStateService);
  private router    = inject(Router);
  private orgTheme  = inject(OrgThemeService);
  private appState  = inject(AppStateService);
  private userAuth  = inject(UserAuthService);
  private realtime  = inject(RealtimeService);
  private fb        = inject(FormBuilder);

  private orgUrlNameForNav = '';

  constructor() {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    });
  }

  /** Live value of the "new password" field, for the strength hints below the inputs. */
  newPasswordValue(): string {
    return this.changePasswordForm.get('newPassword')?.value ?? '';
  }

  pwHasUpper()   { return /[A-Z]/.test(this.newPasswordValue()); }
  pwHasNumber()  { return /[0-9]/.test(this.newPasswordValue()); }
  pwHasSpecial() { return /[^A-Za-z0-9]/.test(this.newPasswordValue()); }

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

  onLoggedIn(): void {
    this.step = 'loading';
    this.orgUrlNameForNav = this.appState.orgUrlName() || this.authState.orgIdentifier();

    this.userAuth.getMe().subscribe({
      next: (res) => {
        if (res.data.accentColor) {
          this.orgTheme.apply(this.orgTheme.generateThemeFromColor(res.data.accentColor));
        }
        this.realtime.connect();

        if (res.data.mustChangePassword) {
          this.mustChangePassword.set(true);
          return;
        }
        this.finishLogin();
      },
      error: () => {
        // /me failed even though login succeeded — fall back to the credentials step
        this.step = 'credentials';
      },
    });
  }

  submitChangePassword(): void {
    this.changePasswordForm.markAllAsTouched();
    if (this.changePasswordForm.invalid || this.changingPassword()) return;
    this.changePasswordError.set('');

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;
    if (newPassword !== confirmPassword) {
      this.changePasswordError.set('Passwords do not match.');
      return;
    }

    this.changingPassword.set(true);
    this.userAuth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.mustChangePassword.set(false);
        this.finishLogin();
      },
      error: (err) => {
        this.changingPassword.set(false);
        this.changePasswordError.set(err?.error?.message ?? 'Could not change password. Please try again.');
      },
    });
  }

  private async finishLogin(): Promise<void> {
    this.loginSuccess = true;
    await this.delay(600);
    await this.router.navigate([`/${this.orgUrlNameForNav}/app/dashboard`]);
  }

  goRegister(): void {
    this.router.navigate(['/free-trial']);
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}
