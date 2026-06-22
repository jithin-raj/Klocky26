import { Component, Output, EventEmitter, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';

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
      next: () => {
        this.loading = false;
        this.loggedIn.emit();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.status === 402
          ? 'Your organisation’s trial/subscription has expired. Please contact your administrator to renew access.'
          : (err?.error?.message ?? 'Invalid email or password.');
      },
    });
  }
}
