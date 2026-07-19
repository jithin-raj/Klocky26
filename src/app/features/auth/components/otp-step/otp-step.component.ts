import {
  Component, Output, EventEmitter, Input, OnInit, OnDestroy,
  ViewChildren, QueryList, ElementRef, ChangeDetectorRef, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { AuthStateService } from '../../services/auth-state.service';
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import { SendOtpResponse } from '../../../../core/models/org-auth.model';

const FALLBACK_EXPIRES_IN_SECONDS = 300;
const FALLBACK_RESEND_IN_SECONDS = 30;

@Component({
  selector: 'klocky-otp-step',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './otp-step.component.html',
  styleUrl: './otp-step.component.scss',
})
export class OtpStepComponent implements OnInit, OnDestroy {
  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;
  /** Emits the single-use verificationToken (4h validity) once verify-otp succeeds. */
  @Output() verified = new EventEmitter<string>();
  @Output() back = new EventEmitter<void>();
  /** Context label shown in the success state — pass org display name */
  @Input() orgName = '';
  /** Set to true when OTP is part of the registration flow */
  @Input() isRegistration = false;
  /** The send-otp response the parent already got before switching to this step — seeds both timers. */
  @Input() sendResult: SendOtpResponse | null = null;

  private cdr = inject(ChangeDetectorRef);
  private orgAuth = inject(OrgAuthService);

  otp: string[] = ['', '', '', '', '', ''];
  loading = false;
  error = '';
  success = false;

  /** Seconds left until the OTP itself expires (drives the input-disable + "expired" state). */
  otpSecondsRemaining = 0;
  otpExpired = false;
  /** Seconds left before "Resend" becomes clickable again. */
  resendSeconds = 0;

  private expiresAtMs = 0;
  private resendAvailableAtMs = 0;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(public state: AuthStateService) {}

  ngOnInit(): void {
    this.applySendResult(this.sendResult);
  }

  ngOnDestroy(): void {
    clearInterval(this.tickTimer);
  }

  get maskedEmail(): string {
    const email = this.state.email();
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const masked = user.slice(0, 2) + '•'.repeat(Math.max(user.length - 2, 3));
    return `${masked}@${domain}`;
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

  /**
   * Seeds both countdowns from a send-otp/resend-otp response and (re)starts
   * the shared 1s tick. Recomputing from absolute timestamps each tick (rather
   * than just decrementing a counter) keeps both timers correct across
   * tab-switches / sleep / clock drift.
   */
  private applySendResult(res: SendOtpResponse | null): void {
    const expiresInSeconds = res?.expiresInSeconds ?? FALLBACK_EXPIRES_IN_SECONDS;
    const resendInSeconds = res?.resendAvailableInSeconds ?? FALLBACK_RESEND_IN_SECONDS;

    this.expiresAtMs = res?.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + expiresInSeconds * 1000;
    this.resendAvailableAtMs = Date.now() + resendInSeconds * 1000;
    this.otpExpired = false;

    clearInterval(this.tickTimer);
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const now = Date.now();

    this.otpSecondsRemaining = Math.max(0, Math.round((this.expiresAtMs - now) / 1000));
    this.resendSeconds = Math.max(0, Math.round((this.resendAvailableAtMs - now) / 1000));

    if (this.otpSecondsRemaining <= 0) this.otpExpired = true;
    if (this.otpSecondsRemaining <= 0 && this.resendSeconds <= 0) clearInterval(this.tickTimer);

    this.cdr.markForCheck();
  }

verifyOtp(): void {
    if (!this.otpComplete || this.loading || this.otpExpired) return;
    this.error = '';
    this.loading = true;

    const code = this.otp.join('');
    this.orgAuth.verifyOtp({ email: this.state.email(), otp: code }).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = true;
        clearInterval(this.tickTimer);
        this.verified.emit(res.data.verificationToken);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Invalid code. Please check and try again.';
        this.otp = ['', '', '', '', '', ''];
        this.cdr.markForCheck();
        setTimeout(() => {
          this.otpBoxes.toArray().forEach(b => { b.nativeElement.value = ''; });
          this.otpBoxes.first?.nativeElement.focus();
        }, 50);
      },
    });
  }

  resendOtp(): void {
    if (this.resendSeconds > 0 || this.loading) return;
    this.otp = ['', '', '', '', '', ''];
    this.error = '';
    this.loading = true;
    this.orgAuth.sendOtp({ organisationName: this.orgName, email: this.state.email() }).subscribe({
      next: (res) => {
        this.loading = false;
        this.applySendResult(res.data);
        setTimeout(() => this.otpBoxes.first?.nativeElement.focus(), 50);
      },
      error: (err) => {
        this.loading = false;
        // 409 = resend cooldown still active server-side
        this.error = err?.error?.message ?? 'Could not resend code. Please try again shortly.';
      },
    });
  }

  onOtpInput(event: Event, index: number): void {
    if (this.otpExpired) return;
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.otp[index] = val;
    input.value = val;
    if (this.error) this.error = ''; // clear error when user starts re-entering
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
}
