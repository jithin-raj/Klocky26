import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { OrgLookupComponent } from '../../components/org-lookup/org-lookup.component';
import { EmailStepComponent } from '../../components/email-step/email-step.component';
import { AuthStateService } from '../../services/auth-state.service';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { MobileBridgeService } from '../../../../core/services/mobile-bridge.service';
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
    <ui-modal [open]="mustChangePassword()" [closeOnBackdrop]="false" size="sm">
      <div class="pwm">
        <div class="pwm-badge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 class="pwm-title">Set a new password</h2>
        <p class="pwm-sub">For your security, choose a new password before continuing — your temporary one won't work again.</p>

        <form class="pwm-form" [formGroup]="changePasswordForm" (ngSubmit)="submitChangePassword()">
          <div class="pwm-field">
            <label for="pwm-current">Current password</label>
            <div class="pwm-input-wrap">
              <input id="pwm-current" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="currentPassword" autocomplete="current-password" placeholder="Temporary password" />
              <button type="button" class="pwm-eye" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide' : 'Show'">
                @if (showPw()) {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <div class="pwm-field">
            <label for="pwm-new">New password</label>
            <div class="pwm-input-wrap">
              <input id="pwm-new" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="newPassword" autocomplete="new-password" placeholder="Min 8 characters" />
              <button type="button" class="pwm-eye" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide' : 'Show'">
                @if (showPw()) {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            @if (newPasswordValue()) {
              <div class="pwm-strength" [attr.data-score]="pwScore()">
                <div class="pwm-strength-track">
                  @for (i of [1,2,3,4]; track i) {
                    <span class="pwm-strength-seg" [class.on]="pwScore() >= i"></span>
                  }
                </div>
                <span class="pwm-strength-label">{{ pwStrengthLabel() }}</span>
              </div>
            }
          </div>

          <div class="pwm-field">
            <label for="pwm-confirm">Confirm new password</label>
            <div class="pwm-input-wrap">
              <input id="pwm-confirm" class="pwm-input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="confirmPassword" autocomplete="new-password" placeholder="Repeat new password" />
              <button type="button" class="pwm-eye" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide' : 'Show'">
                @if (showPw()) {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <div class="pwm-reqs">
            <span class="pwm-req" [class.ok]="newPasswordValue().length >= 8"><span class="pwm-req-tick"></span>8+ characters</span>
            <span class="pwm-req" [class.ok]="pwHasUpper()"><span class="pwm-req-tick"></span>Uppercase</span>
            <span class="pwm-req" [class.ok]="pwHasNumber()"><span class="pwm-req-tick"></span>Number</span>
            <span class="pwm-req" [class.ok]="pwHasSpecial()"><span class="pwm-req-tick"></span>Special character</span>
          </div>

          @if (changePasswordError()) {
            <p class="pwm-error">{{ changePasswordError() }}</p>
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

    /* ── Password-change modal — modern, org-branded (uses --accent set by OrgThemeService) ── */
    .pwm { padding: 30px 30px 30px; text-align: center; }
    .pwm-badge {
      width: 58px; height: 58px; margin: 0 auto 18px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 18px; color: #fff;
      background: linear-gradient(140deg, var(--accent, #0d9488), color-mix(in srgb, var(--accent, #0d9488) 62%, #000));
      box-shadow: 0 10px 24px -6px color-mix(in srgb, var(--accent, #0d9488) 55%, transparent),
                  inset 0 1px 0 rgba(255,255,255,.28);
    }
    .pwm-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 7px; letter-spacing: -0.4px; }
    .pwm-sub { font-size: 13.5px; color: #64748b; margin: 0 0 24px; line-height: 1.55; }

    .pwm-form { display: flex; flex-direction: column; gap: 14px; }
    .pwm-field { display: flex; flex-direction: column; gap: 6px; text-align: left; }
    .pwm-field label { font-size: 12.5px; font-weight: 650; color: #334155; }
    .pwm-input-wrap { position: relative; display: flex; align-items: center; }
    .pwm-input {
      padding: 12px 42px 12px 14px; border: 1.5px solid #e6eaf1; border-radius: 12px;
      font-size: 14px; color: #1e293b; outline: none; width: 100%; box-sizing: border-box;
      background: #fbfcfe;
      transition: border-color .15s, box-shadow .15s, background .15s;
    }
    .pwm-input::placeholder { color: #aab4c2; }
    .pwm-input:focus {
      border-color: var(--accent, #0d9488); background: #fff;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #0d9488) 14%, transparent);
    }
    .pwm-eye {
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border: none; background: none; cursor: pointer;
      color: #94a3b8; border-radius: 8px; transition: color .12s, background .12s;
    }
    .pwm-eye:hover { color: var(--accent, #0d9488); background: #f1f5f9; }

    /* Strength meter */
    .pwm-strength { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
    .pwm-strength-track { display: flex; gap: 4px; flex: 1; }
    .pwm-strength-seg { height: 4px; flex: 1; border-radius: 4px; background: #e6eaf1; transition: background .2s; }
    .pwm-strength-label { font-size: 11.5px; font-weight: 700; color: #94a3b8; min-width: 52px; text-align: right; }
    .pwm-strength[data-score="1"] .pwm-strength-seg.on { background: #ef4444; }
    .pwm-strength[data-score="1"] .pwm-strength-label { color: #ef4444; }
    .pwm-strength[data-score="2"] .pwm-strength-seg.on { background: #f59e0b; }
    .pwm-strength[data-score="2"] .pwm-strength-label { color: #f59e0b; }
    .pwm-strength[data-score="3"] .pwm-strength-seg.on { background: #eab308; }
    .pwm-strength[data-score="3"] .pwm-strength-label { color: #ca8a04; }
    .pwm-strength[data-score="4"] .pwm-strength-seg.on { background: #16a34a; }
    .pwm-strength[data-score="4"] .pwm-strength-label { color: #16a34a; }

    /* Requirement chips */
    .pwm-reqs {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px;
      margin: 4px 0 4px; text-align: left;
    }
    .pwm-req { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #94a3b8; transition: color .15s; }
    .pwm-req-tick {
      width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
      border: 1.5px solid #cbd5e1; position: relative; transition: all .15s;
    }
    .pwm-req.ok { color: #16a34a; font-weight: 600; }
    .pwm-req.ok .pwm-req-tick { background: #16a34a; border-color: #16a34a; }
    .pwm-req.ok .pwm-req-tick::after {
      content: ''; position: absolute; left: 4.5px; top: 2px; width: 4px; height: 7px;
      border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
    }

    .pwm-error {
      background: #fef2f2; color: #dc2626; font-size: 12.5px; font-weight: 600;
      padding: 10px 14px; border-radius: 10px; margin: 0; text-align: left;
      border: 1px solid #fecaca;
    }
    .pwm-btn {
      width: 100%; padding: 13px; border: none; border-radius: 12px; margin-top: 4px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent, #0d9488) 92%, #fff), var(--accent, #0d9488));
      color: #fff; font-size: 14.5px; font-weight: 700; cursor: pointer;
      box-shadow: 0 1px 1px rgba(15,23,42,.12), 0 12px 24px -8px color-mix(in srgb, var(--accent, #0d9488) 60%, transparent);
      transition: filter .15s, transform .1s, box-shadow .15s;
    }
    .pwm-btn:hover:not(:disabled) { filter: brightness(1.04); }
    .pwm-btn:active:not(:disabled) { transform: translateY(1px); }
    .pwm-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
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
  private permissions = inject(PermissionService);
  private realtime  = inject(RealtimeService);
  private bridge    = inject(MobileBridgeService);
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

  /** 0–4 satisfied rules — drives the strength meter. */
  pwScore(): number {
    let s = 0;
    if (this.newPasswordValue().length >= 8) s++;
    if (this.pwHasUpper())   s++;
    if (this.pwHasNumber())  s++;
    if (this.pwHasSpecial()) s++;
    return s;
  }
  pwStrengthLabel(): string {
    return ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][this.pwScore()];
  }

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
        // Mobile: tell the RN shell we're in and register the device for push.
        this.bridge.onLogin();

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
    // Resolve the permission map before routing so the shell renders gated UI
    // correctly on first paint (the permissionGuard also lazy-loads as a fallback).
    try { await firstValueFrom(this.permissions.load()); } catch { /* guard re-loads on demand */ }
    await this.delay(600);
    await this.router.navigate([`/${this.orgUrlNameForNav}/app/dashboard`]);
  }

  goRegister(): void {
    this.router.navigate(['/free-trial']);
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}
