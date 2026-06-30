import { Component, inject, OnInit, signal } from '@angular/core';
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
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import { UserAuthService } from '../../../../core/services/user-auth.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  INDUSTRIES,
  COMPANY_SIZES,
  TIMEZONE_OPTIONS,
  COUNTRIES,
  COUNTRY_DEFAULT_TIMEZONE,
  WEEKDAYS,
} from '../../../../core/config/form-options.const';
import { SelectOption } from '../../../../shared/components/ui-select/ui-select.component';
import { ORG_CODE_PATTERN, toOrgSlug } from '../../../../core/utils/org-slug.util';

type RegStep = 'org-info' | 'admin-email' | 'otp' | 'org-profile' | 'done';

// This field is the short user-facing code (e.g. "acme-corp") — the backend
// appends ".klock" itself when it derives the real slug from organisationName.
const SLUG_PATTERN = ORG_CODE_PATTERN;

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

  /** Single-use token from verify-otp (4h validity), needed by the final register call */
  private verificationToken = '';

  readonly authState = inject(AuthStateService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private orgTheme = inject(OrgThemeService);
  private orgAuth = inject(OrgAuthService);
  private userAuth = inject(UserAuthService);
  private toast = inject(ToastService);

  ngOnInit(): void {
    this.orgTheme.reset();

    // GET /api/tenant/options (§1.6) — populate countries/timezones from the
    // server's fixed list; keep the local constants as a fallback if the
    // call fails (industry/companySize aren't part of this response, so
    // those stay on the local constants permanently).
    this.orgAuth.getTenantOptions().subscribe({
      next: (res) => {
        if (res.data.countries?.length) this.countries.set(res.data.countries);
        if (res.data.timezones?.length) this.timezones.set(res.data.timezones);
      },
      error: () => { /* keep the local fallback lists */ },
    });

    // Auto-fill the timezone once a country is picked (client-side default —
    // see COUNTRY_DEFAULT_TIMEZONE). Only overwrites if the timezone field is
    // still empty or still holds the last value *this* auto-fill set, so a
    // manual override afterward sticks.
    this.profileForm.get('country')!.valueChanges.subscribe((country: string) => {
      const tz = COUNTRY_DEFAULT_TIMEZONE[country];
      if (!tz) return;
      const tzControl = this.profileForm.get('timezone')!;
      if (!tzControl.value || tzControl.value === this._lastAutoTimezone) {
        tzControl.setValue(tz);
        this._lastAutoTimezone = tz;
      }
    });
  }

  private _lastAutoTimezone = '';

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

  // ── Reference data ──────────────────────────────────────────────
  // industry/companySize have no server-side list (not in §1.6) — local only.
  readonly industries  = INDUSTRIES;
  readonly companySizes = COMPANY_SIZES;
  readonly weekdays    = WEEKDAYS;
  // country/timezone start from the local constants, replaced once
  // GET /api/tenant/options resolves (see ngOnInit). Timezone defaults to the
  // {label,value} form so the submitted value is the IANA id (e.g.
  // "Asia/Kolkata", what RegisterOrgRequest.defaultTimezone expects) while
  // still showing a friendly label — plain label strings were being
  // submitted as the value before this.
  readonly countries = signal<string[]>(COUNTRIES);
  readonly timezones = signal<SelectOption[]>(TIMEZONE_OPTIONS);

  // ── Validation helpers ────────────────────────────────────────
  isInvalid(form: FormGroup, field: string): boolean {
    const ctrl: AbstractControl = form.get(field)!;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  /** Temp password shown exactly once after registration succeeds */
  temporaryPassword = '';
  /** The real, server-derived slug (includes the ".klock" suffix) — set once registerOrg() succeeds */
  private registeredOrgSlug = '';
  /** Real, server-derived URL path segment — use this for navigation, not registeredOrgSlug. */
  private registeredOrgUrlName = '';

  // ── Step 1 ───────────────────────────────────────────────────
  submitOrgInfo(): void {
    this.orgInfoForm.markAllAsTouched();
    if (this.orgInfoForm.invalid || this.loading) return;
    this.error = '';
    const { orgName, orgSlug } = this.orgInfoForm.value;
    this.authState.setOrg(orgSlug, orgName.trim());
    this.step = 'admin-email';
  }

  // ── Step 2 — sends the OTP ────────────────────────────────────
  submitAdminEmail(): void {
    this.adminForm.markAllAsTouched();
    if (this.adminForm.invalid || this.loading) return;
    this.error = '';
    this.loading = true;
    const email = this.adminForm.value.adminEmail.trim();
    this.authState.setEmail(email);

    this.orgAuth.sendOtp({ organisationName: this.authState.orgDisplayName(), email }).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'otp';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Could not send the verification code. Please try again.';
        this.toast.error('Could not send code', this.error);
      },
    });
  }

  // ── Step 3: OTP verified ──────────────────────────────────────
  onOtpVerified(verificationToken: string): void {
    this.verificationToken = verificationToken;
    this.step = 'org-profile';
  }

  // ── Step 4: org profile → final registration call ────────────
  submitOrgProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.loading) return;
    this.error = '';
    this.loading = true;

    const { orgName, orgSlug } = this.orgInfoForm.value;
    const { adminEmail } = this.adminForm.value;
    const { industry, companySize, country, timezone, workWeekStart, workWeekEnd, website } =
      this.profileForm.value;

    this.orgAuth.registerOrg({
      verificationToken: this.verificationToken,
      organisationName: orgName.trim(),
      displayName: orgName.trim(),
      primaryEmail: adminEmail.trim(),
      industry,
      companySize,
      country,
      defaultTimezone: timezone,
      emailDomain: adminEmail.split('@')[1] ?? '',
      website: website || undefined,

      clockInMethods: ['web'],
      weekStartDay: (workWeekStart ?? 'Monday').toLowerCase(),
      weekEndDay: (workWeekEnd ?? 'Friday').toLowerCase(),
      workHours: 8,
      workDayStart: '09:00',
      workDayEnd: '18:00',
      autoCheckoutBufferMins: 0,
      minPunchGapMins: 2,
      checkInRuleType: 'none',
      halfDayThresholdHrs: 4,
      lateThresholdMins: 15,
      locationPolicy: 'no_restrictions',
      overtimeEnabled: false,
      requirePhotoOnClockIn: false,
      ipRestrictionEnabled: false,
      selfieVerificationEnabled: false,
      autoCheckoutEnabled: false,
      currency: 'INR',
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.temporaryPassword = res.data.temporaryPassword ?? '';
        // The backend derives the real slug from organisationName itself —
        // use what it actually returned, not the client-side guess in
        // orgInfoForm.orgSlug (which is just a UI preview).
        this.registeredOrgSlug = res.data.orgSlug;
        this.registeredOrgUrlName = res.data.orgUrlName;
        this.step = 'done';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Registration failed. Please try again.';
        this.toast.error('Could not create organisation', this.error);
      },
    });
  }

  skipProfile(): void { this.step = 'done'; }

  // ── Step 5: done — log straight into the app as the new admin ─
  goToDashboard(): void {
    if (this.loading) return;
    this.loading = true;
    // Fall back to a client-side guess only if registerOrg() somehow didn't
    // return these — the real ones are always preferred.
    const orgSlug = this.registeredOrgSlug || toOrgSlug(this.orgInfoForm.value.orgSlug);
    const orgUrlName = this.registeredOrgUrlName || this.orgInfoForm.value.orgSlug;
    const email = this.adminForm.value.adminEmail.trim();

    this.userAuth.login({ orgSlug, email, password: this.temporaryPassword }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate([`/${orgUrlName}/app/dashboard`]);
      },
      error: () => {
        // Auto-login failed for any reason — fall back to the normal login screen.
        this.loading = false;
        this.router.navigate(['/login']);
      },
    });
  }

  goBack(): void {
    if (this.step === 'admin-email') this.step = 'org-info';
    else if (this.step === 'otp')    this.step = 'admin-email';
  }

  goLogin(): void { this.router.navigate(['/login']); }

  stepIndex(): number {
    return { 'org-info': 1, 'admin-email': 2, 'otp': 3, 'org-profile': 4, 'done': 5 }[this.step];
  }
}

