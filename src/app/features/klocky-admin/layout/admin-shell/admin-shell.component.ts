import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { PlatformAdminService } from '../../../../core/services/platform-admin.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal.component';
import { UiInputComponent } from '../../../../shared/components/ui-input/ui-input.component';

@Component({
  selector: 'klocky-admin-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule, UiModalComponent, UiInputComponent],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private loading = inject(LoadingService);
  /** True while any HTTP request is in flight — drives the global top loading bar. */
  readonly isApiLoading = computed(() => this.loading.isLoading());

  readonly sidebarOpen = signal(true);

  readonly changePasswordOpen = signal(false);
  readonly changePasswordSubmitting = signal(false);
  readonly changePasswordError = signal('');
  readonly changePasswordSuccess = signal(false);
  changePasswordForm: FormGroup;

  private fb = inject(FormBuilder);

  constructor(
    private router: Router,
    private orgTheme: OrgThemeService,
    private platformAdmin: PlatformAdminService,
  ) {
    // Klocky's own panel always uses the default green theme.
    this.orgTheme.reset();

    this.changePasswordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  openChangePassword(): void {
    this.changePasswordError.set('');
    this.changePasswordSuccess.set(false);
    this.changePasswordForm.reset();
    this.changePasswordOpen.set(true);
  }

  submitChangePassword(): void {
    this.changePasswordForm.markAllAsTouched();
    if (this.changePasswordForm.invalid || this.changePasswordSubmitting()) return;
    this.changePasswordError.set('');
    this.changePasswordSubmitting.set(true);

    this.platformAdmin.changePassword(this.changePasswordForm.value).subscribe({
      next: () => {
        this.changePasswordSubmitting.set(false);
        this.changePasswordSuccess.set(true);
      },
      error: (err) => {
        this.changePasswordSubmitting.set(false);
        this.changePasswordError.set(err?.error?.message ?? 'Could not change password.');
      },
    });
  }

  logout(): void {
    this.platformAdmin.logout();
    this.router.navigate(['/klocky-admin']);
  }
}
