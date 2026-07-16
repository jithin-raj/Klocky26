import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { PlatformAdminService } from '../../../../core/services/platform-admin.service';

@Component({
  selector: 'klocky-admin-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  readonly submitting = signal(false);
  readonly loginError = signal('');
  readonly showPw = signal(false);

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private orgTheme: OrgThemeService,
    private platformAdmin: PlatformAdminService,
  ) {
    // Klocky's own panel always uses the default green theme, regardless of
    // any org theme left over from a previous session.
    this.orgTheme.reset();

    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field)!;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.loginError.set('');
    this.submitting.set(true);

    const { email, password } = this.form.value;
    this.platformAdmin.login({ email, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/klocky-admin/dashboard']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.loginError.set(err?.error?.message ?? 'Invalid email or password. Please try again.');
      },
    });
  }
}
