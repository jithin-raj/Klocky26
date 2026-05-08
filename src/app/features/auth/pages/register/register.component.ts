import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { AuthStateService } from '../../services/auth-state.service';
import { OtpStepComponent } from '../../components/otp-step/otp-step.component';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import {
  INDUSTRIES,
  COMPANY_SIZES,
  TIMEZONE_STRINGS,
  WEEKDAYS,
} from '../../../../core/config/form-options.const';

type RegStep = 'org-info' | 'admin-email' | 'otp' | 'org-profile' | 'done';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;

@Component({
  selector: 'klocky-register',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, SlicePipe, OtpStepComponent, UiSelectComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  step: RegStep = 'org-info';
  loading = false;
  error = '';

  readonly authState = inject(AuthStateService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private orgTheme = inject(OrgThemeService);

  ngOnInit(): void {
    this.orgTheme.reset();
  }

  // ── Form groups per step ──────────────────────────────────────
  readonly orgInfoForm: FormGroup = this.fb.group({
    orgName: ['', [Validators.required, Validators.minLength(2)]],
    orgSlug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN)]],
  });

  readonly adminForm: FormGroup = this.fb.group({
    adminName:  ['', [Validators.required, Validators.minLength(2)]],
    adminEmail: ['', [Validators.required, Validators.email]],
  });

  readonly profileForm: FormGroup = this.fb.group({
    industry:      ['', Validators.required],
    companySize:   ['', Validators.required],
    country:       ['', Validators.required],
    timezone:      ['', Validators.required],
    workWeekStart: ['Monday'],
    workWeekEnd:   ['Friday'],
    workDayStart:  ['09:00'],
    workDayEnd:    ['18:00'],
    website:       [''],
  });

  // ── Slug auto-generation ──────────────────────────────────────
  private slugTouched = false;

  onOrgNameChange(): void {
    if (!this.slugTouched) {
      const raw: string = this.orgInfoForm.get('orgName')!.value ?? '';
      const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      this.orgInfoForm.get('orgSlug')!.setValue(slug, { emitEvent: false });
    }
  }

  onSlugFocus(): void { this.slugTouched = true; }

  // ── Reference data (from shared constants) ───────────────────
  readonly industries  = INDUSTRIES;
  readonly companySizes = COMPANY_SIZES;
  readonly timezones   = TIMEZONE_STRINGS;
  readonly weekdays    = WEEKDAYS;

  // ── Validation helpers ────────────────────────────────────────
  isInvalid(form: FormGroup, field: string): boolean {
    const ctrl: AbstractControl = form.get(field)!;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  // ── Step 1 ───────────────────────────────────────────────────
  async submitOrgInfo(): Promise<void> {
    this.orgInfoForm.markAllAsTouched();
    if (this.orgInfoForm.invalid || this.loading) return;
    this.error = '';
    this.loading = true;
    await this.delay(700);
    this.loading = false;
    const { orgName, orgSlug } = this.orgInfoForm.value;
    console.log('[Register] Step 1 — Org Info:', { orgName, orgSlug });
    this.authState.setOrg(orgSlug, orgName.trim());
    this.step = 'admin-email';
  }

  // ── Step 2 ───────────────────────────────────────────────────
  async submitAdminEmail(): Promise<void> {
    this.adminForm.markAllAsTouched();
    if (this.adminForm.invalid || this.loading) return;
    this.error = '';
    this.loading = true;
    await this.delay(900);
    this.loading = false;
    console.log('[Register] Step 2 — Admin:', this.adminForm.value);
    this.authState.setEmail(this.adminForm.value.adminEmail.trim());
    this.step = 'otp';
  }

  // ── Step 3: OTP verified ──────────────────────────────────────
  onOtpVerified(): void { this.step = 'org-profile'; }

  // ── Step 4: org profile ───────────────────────────────────────
  async submitOrgProfile(): Promise<void> {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.loading) return;
    this.error = '';
    this.loading = true;
    await this.delay(1000);
    this.loading = false;
    console.log('[Register] Step 4 — Org Profile:', this.profileForm.value);
    console.log('[Register] Full registration payload:', {
      ...this.orgInfoForm.value,
      ...this.adminForm.value,
      ...this.profileForm.value,
    });
    this.step = 'done';
  }

  skipProfile(): void { this.step = 'done'; }

  // ── Step 5: done ──────────────────────────────────────────────
  async goToDashboard(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    await this.delay(600);
    const orgSlug = this.authState.regOrgSlug() || 'demo';
    this.router.navigate([`/${orgSlug}/app/dashboard`]);
  }

  goBack(): void {
    if (this.step === 'admin-email') this.step = 'org-info';
    else if (this.step === 'otp')    this.step = 'admin-email';
  }

  goLogin(): void { this.router.navigate(['/login']); }

  stepIndex(): number {
    return { 'org-info': 1, 'admin-email': 2, 'otp': 3, 'org-profile': 4, 'done': 5 }[this.step];
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

