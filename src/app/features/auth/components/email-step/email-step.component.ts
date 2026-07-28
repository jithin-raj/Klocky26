import {
  Component, Output, EventEmitter, OnInit, OnDestroy,
  ViewChildren, QueryList, ElementRef, ChangeDetectorRef, inject,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { PublicLegalDocumentModalComponent } from '../../../../shared/components/public-legal-document-modal/public-legal-document-modal.component';
import { LoginOptionsResponse, RequestMobileOtpResponse } from '../../../../core/models/user.model';

type LoginMethod = 'email' | 'mobile';
type MobileStep = 'phone' | 'otp';

const FALLBACK_EXPIRES_IN_SECONDS = 300;
const FALLBACK_RESEND_IN_SECONDS = 30;

/** Mobile OTP login is India-only (INTEGRATION_GUIDE.md §3) — the prefix is fixed, not a picker. */
const MOBILE_DIAL_CODE = '91';

@Component({
  selector: 'klocky-email-step',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PublicLegalDocumentModalComponent],
  templateUrl: './email-step.component.html',
  styleUrl: './email-step.component.scss',
})
export class EmailStepComponent implements OnInit, OnDestroy {
  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;
  /** Emits once a session is persisted — password login or mobile OTP, either path. */
  @Output() loggedIn = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  loading = false;
  error = '';
  showPassword = false;

  form: FormGroup;

  private userAuth = inject(UserAuthService);
  private subscription = inject(SubscriptionService);
  private cdr = inject(ChangeDetectorRef);

  constructor(public state: AuthStateService, private fb: FormBuilder) {
    this.form = this.fb.group({
      emailInput:    ['', [Validators.required, Validators.email]],
      passwordInput: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // ── Which login methods this org offers ─────────────────────────
  loginOptions: LoginOptionsResponse | null = null;
  method: LoginMethod = 'email';

  ngOnInit(): void {
    const orgSlug = this.state.orgSlugForLogin();
    if (!orgSlug) return;
    this.userAuth.getLoginOptions(orgSlug).subscribe({
      next: (res) => { this.loginOptions = res.data; this.cdr.markForCheck(); },
      // Endpoint unavailable/errored — degrade to the existing email+password-only experience.
      error: () => { this.loginOptions = null; },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.otpTickTimer);
  }

  setMethod(m: LoginMethod): void {
    if (this.method === m) return;
    this.method = m;
    this.error = '';
  }

  get emailInvalid(): boolean {
    const ctrl = this.form.get('emailInput')!;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  get passwordInvalid(): boolean {
    const ctrl = this.form.get('passwordInput')!;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading) return;
    this.error = '';
    this.loading = true;

    const email = this.form.value.emailInput.trim();
    this.state.setEmail(email);

    this.userAuth.login({
      orgSlug: this.state.orgSlugForLogin(),
      email,
      password: this.form.value.passwordInput,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        // Admins/HR can still log in with an expired subscription (per §1) — set
        // the gate immediately so finishLogin() routes straight to /billing
        // instead of /dashboard, without waiting on a /org/subscription round-trip.
        if (res.data.subscriptionExpired != null) {
          this.subscription.setExpired(res.data.subscriptionExpired);
        }
        this.loggedIn.emit();
      },
      error: (err) => {
        this.loading = false;
        const serverMsg: string = err?.error?.message ?? err?.error?.error ?? '';
        // Regular employees are rejected outright (401) when the org's subscription
        // has expired — the server's own message explains it; 402 is the legacy/
        // org-wide-block variant. Either way, surface the server's wording.
        const isExpiredRejection = err?.status === 402 || (err?.status === 401 && /expired/i.test(serverMsg));
        this.error = isExpiredRejection
          ? (serverMsg || 'Your organisation’s trial/subscription has expired. Please contact your administrator to renew access.')
          : (serverMsg || 'Invalid email or password.');
      },
    });
  }

  // ── Mobile OTP login ──────────────────────────────────────────────

  mobileStep: MobileStep = 'phone';
  phoneNational = '';
  otp: string[] = ['', '', '', '', '', ''];

  get fullPhone(): string {
    return `+${MOBILE_DIAL_CODE}${this.phoneNational.replace(/\D/g, '')}`;
  }

  get phoneValid(): boolean {
    return this.phoneNational.replace(/\D/g, '').length >= 10;
  }

  get otpComplete(): boolean { return this.otp.every(d => d !== ''); }

  /** mm:ss display for the OTP expiry countdown. */
  get otpTimeLabel(): string {
    return this.formatMmSs(this.otpSecondsRemaining);
  }

  private formatMmSs(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.phoneNational = input.value.replace(/\D/g, '');
    input.value = this.phoneNational;
    if (this.error) this.error = '';
  }

  requestOtp(): void {
    if (!this.phoneValid || this.loading) return;
    this.error = '';
    this.loading = true;
    const phone = this.fullPhone;
    this.state.setMobileNumber(phone);

    this.userAuth.requestMobileOtp({ orgSlug: this.state.orgSlugForLogin(), phone }).subscribe({
      next: (res) => {
        this.loading = false;
        this.otp = ['', '', '', '', '', ''];
        this.mobileStep = 'otp';
        this.applySendResult(res.data);
        setTimeout(() => this.otpBoxes?.first?.nativeElement.focus(), 50);
      },
      error: (err) => {
        this.loading = false;
        this.error = this.mobileErrorMessage(err, 'Could not send the code. Please try again.');
      },
    });
  }

  backToPhone(): void {
    clearInterval(this.otpTickTimer);
    this.mobileStep = 'phone';
    this.error = '';
  }

  verifyOtp(): void {
    if (!this.otpComplete || this.loading || this.otpExpired) return;
    this.error = '';
    this.loading = true;

    const code = this.otp.join('');
    this.userAuth.verifyMobileOtp({
      orgSlug: this.state.orgSlugForLogin(),
      phone: this.fullPhone,
      otp: code,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        clearInterval(this.otpTickTimer);
        if (res.data.subscriptionExpired != null) {
          this.subscription.setExpired(res.data.subscriptionExpired);
        }
        this.loggedIn.emit();
      },
      error: (err) => {
        this.loading = false;
        this.error = this.mobileErrorMessage(err, 'Invalid or expired code. Please check and try again.');
        this.otp = ['', '', '', '', '', ''];
        this.cdr.markForCheck();
        setTimeout(() => {
          this.otpBoxes?.toArray().forEach(b => { b.nativeElement.value = ''; });
          this.otpBoxes?.first?.nativeElement.focus();
        }, 50);
      },
    });
  }

  resendOtp(): void {
    if (this.resendSeconds > 0 || this.loading) return;
    this.otp = ['', '', '', '', '', ''];
    this.error = '';
    this.loading = true;
    this.userAuth.requestMobileOtp({ orgSlug: this.state.orgSlugForLogin(), phone: this.fullPhone }).subscribe({
      next: (res) => {
        this.loading = false;
        this.applySendResult(res.data);
        setTimeout(() => this.otpBoxes?.first?.nativeElement.focus(), 50);
      },
      error: (err) => {
        this.loading = false;
        this.error = this.mobileErrorMessage(err, 'Could not resend the code. Please try again shortly.');
      },
    });
  }

  /** Maps the mobile OTP endpoints' documented status codes to a friendly message; falls back to the server's own wording. */
  private mobileErrorMessage(err: any, fallback: string): string {
    const serverMsg: string = err?.error?.message ?? err?.error?.error ?? '';
    const status = err?.status;
    if (status === 402) return serverMsg || 'Your organisation’s trial/subscription has expired. Please contact your administrator to renew access.';
    if (status === 404) return serverMsg || 'No account found for this mobile number.';
    if (status === 409) return serverMsg || 'Please wait before requesting another code.';
    if (status === 400) return serverMsg || fallback;
    return serverMsg || fallback;
  }

  onOtpInput(event: Event, index: number): void {
    if (this.otpExpired) return;
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.otp[index] = val;
    input.value = val;
    if (this.error) this.error = '';
    if (val && index < 5) this.otpBoxes.toArray()[index + 1]?.nativeElement.focus();
    if (this.otpComplete) setTimeout(() => this.verifyOtp(), 200);
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (this.otpExpired) return;
    if (event.key === 'Backspace') {
      if (!this.otp[index] && index > 0) {
        this.otp[index - 1] = '';
        this.otpBoxes.toArray()[index - 1]?.nativeElement.focus();
        event.preventDefault();
      } else {
        this.otp[index] = '';
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.otpBoxes.toArray()[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.otpBoxes.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    if (this.otpExpired) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { this.otp[i] = d; });
    const focusIdx = Math.min(digits.length, 5);
    this.otpBoxes.toArray()[focusIdx]?.nativeElement.focus();
    if (digits.length === 6) setTimeout(() => this.verifyOtp(), 200);
  }

  // ── OTP timers (mirrors the registration OTP step's absolute-timestamp approach) ──

  otpSecondsRemaining = 0;
  otpExpired = false;
  resendSeconds = 0;

  private expiresAtMs = 0;
  private resendAvailableAtMs = 0;
  private otpTickTimer?: ReturnType<typeof setInterval>;

  private applySendResult(res: RequestMobileOtpResponse | null): void {
    const expiresInSeconds = res?.expiresInSeconds ?? FALLBACK_EXPIRES_IN_SECONDS;
    const resendInSeconds = res?.resendAvailableInSeconds ?? FALLBACK_RESEND_IN_SECONDS;

    this.expiresAtMs = res?.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + expiresInSeconds * 1000;
    this.resendAvailableAtMs = Date.now() + resendInSeconds * 1000;
    this.otpExpired = false;

    clearInterval(this.otpTickTimer);
    this.otpTick();
    this.otpTickTimer = setInterval(() => this.otpTick(), 1000);
  }

  private otpTick(): void {
    const now = Date.now();
    this.otpSecondsRemaining = Math.max(0, Math.round((this.expiresAtMs - now) / 1000));
    this.resendSeconds = Math.max(0, Math.round((this.resendAvailableAtMs - now) / 1000));
    if (this.otpSecondsRemaining <= 0) this.otpExpired = true;
    if (this.otpSecondsRemaining <= 0 && this.resendSeconds <= 0) clearInterval(this.otpTickTimer);
    this.cdr.markForCheck();
  }
}
