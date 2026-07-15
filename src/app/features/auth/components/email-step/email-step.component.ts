import { Component, Output, EventEmitter, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';

@Component({
  selector: 'klocky-email-step',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './email-step.component.html',
  styleUrl: './email-step.component.scss',
})
export class EmailStepComponent {
  /** Emits once POST /api/users/auth/login succeeds and the session is persisted. */
  @Output() loggedIn = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  loading = false;
  error = '';
  showPassword = false;

  form: FormGroup;

  private userAuth = inject(UserAuthService);
  private subscription = inject(SubscriptionService);

  constructor(public state: AuthStateService, private fb: FormBuilder) {
    this.form = this.fb.group({
      emailInput:    ['', [Validators.required, Validators.email]],
      passwordInput: ['', [Validators.required, Validators.minLength(6)]],
    });
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
}
