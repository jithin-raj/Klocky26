import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrialEmailStepComponent, TrialStartData } from '../../components/trial-email-step/trial-email-step.component';
import { CompanySetupComponent } from '../../components/company-setup/company-setup.component';
import { OrgSetupData } from '../../components/org-setup-tab/org-setup-tab.component';
import { AttendanceSetupData } from '../../components/attendance-setup-tab/attendance-setup-tab.component';
import { OtpStepComponent } from '../../../auth/components/otp-step/otp-step.component';
import { AuthShellComponent } from '../../../auth/components/auth-shell/auth-shell.component';
import { AuthStateService } from '../../../auth/services/auth-state.service';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import {
  mapTimezoneLabel,
  normalizeCompanySize,
  mapLocationRule,
  mapGracePeriod,
  mapLateThresholdMins,
} from '../../../../core/utils/onboarding-mapping.util';

export type TrialStep = 'email' | 'otp' | 'setup' | 'done';

@Component({
  selector: 'ob-free-trial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrialEmailStepComponent, OtpStepComponent, AuthShellComponent, CompanySetupComponent],
  templateUrl: './free-trial.component.html',
  styleUrl: './free-trial.component.scss',
})
export class FreeTrialComponent implements OnInit {
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private orgTheme = inject(OrgThemeService);
  private orgAuth = inject(OrgAuthService);
  private toast   = inject(ToastService);

  step       = signal<TrialStep>('email');
  adminEmail = signal('');
  orgName    = signal('');

  /** GET /api/tenant/options clockInMethods — fetched once, forwarded to the attendance setup tab. Never hardcoded. */
  methodOptions = signal<string[]>([]);

  /** Surfaced on the email step if send-otp fails (e.g. org/email already taken). */
  emailStepError = signal('');
  emailStepSubmitting = signal(false);

  /** Surfaced on the setup step if the final register call fails. */
  setupError = signal('');
  setupSubmitting = signal(false);

  /** Single-use token from verify-otp (4h validity), needed by the final register call */
  private verificationToken = '';

  ngOnInit(): void {
    this.orgTheme.reset();
    this.orgAuth.getTenantOptions().subscribe({
      next: (res) => {
        if (res.data.clockInMethods?.length) this.methodOptions.set(res.data.clockInMethods);
      },
      error: () => { /* attendance tab shows "loading available methods" until this resolves */ },
    });
  }

  onEmailSubmitted(data: TrialStartData): void {
    if (this.emailStepSubmitting()) return;
    this.emailStepError.set('');
    this.emailStepSubmitting.set(true);

    this.orgName.set(data.orgName);
    this.adminEmail.set(data.email);
    this.authState.setEmail(data.email);

    this.orgAuth.sendOtp({ organisationName: data.orgName, email: data.email }).subscribe({
      next: () => {
        this.emailStepSubmitting.set(false);
        this.step.set('otp');
      },
      error: (err) => {
        this.emailStepSubmitting.set(false);
        const message = err?.error?.message ?? 'Could not send the verification code. Please try again.';
        this.emailStepError.set(message);
        this.toast.error('Could not send code', message);
      },
    });
  }

  onOtpVerified(verificationToken: string): void {
    this.verificationToken = verificationToken;
    this.step.set('setup');
  }

  onSetupComplete(payload: { org: OrgSetupData; attendance: AttendanceSetupData }): void {
    if (this.setupSubmitting()) return;
    this.setupError.set('');
    this.setupSubmitting.set(true);

    const { org, attendance } = payload;
    const { checkInRuleType, checkInCustomMinutes } = mapGracePeriod(attendance.gracePeriod);

    this.orgAuth.registerOrg({
      verificationToken: this.verificationToken,
      organisationName: org.orgName,
      displayName: org.displayName || org.orgName,
      primaryEmail: this.adminEmail(),
      industry: org.industry,
      companySize: normalizeCompanySize(org.companySize),
      country: org.country,
      defaultTimezone: mapTimezoneLabel(org.timezone),
      emailDomain: org.emailDomain || this.adminEmail().split('@')[1] || '',
      website: org.website || undefined,

      clockInMethods: attendance.clockInMethods as any,
      weekStartDay: attendance.workWeekStart.toLowerCase(),
      weekEndDay: attendance.workWeekEnd.toLowerCase(),
      workHours: attendance.workHoursPerDay,
      workDayStart: attendance.workDayStart || '09:00',
      workDayEnd: attendance.workDayEnd || '18:00',
      autoCheckoutBufferMins: attendance.autoCheckoutBufferMins ?? 0,
      minPunchGapMins: attendance.minPunchGapMins ?? 2,
      checkInRuleType,
      checkInCustomMinutes,
      halfDayThresholdHrs: attendance.halfDayThresholdHrs,
      lateThresholdMins: mapLateThresholdMins(attendance.lateThreshold),
      locationPolicy: mapLocationRule(attendance.locationRule),
      overtimeEnabled: attendance.overtimeEnabled,
      requirePhotoOnClockIn: attendance.requirePhoto,
      ipRestrictionEnabled: attendance.ipRestriction,
      selfieVerificationEnabled: attendance.selfieVerification,
      autoCheckoutEnabled: attendance.autoCheckoutEnabled,
      currency: 'INR',
    }).subscribe({
      next: () => {
        this.setupSubmitting.set(false);
        this.step.set('done');
      },
      error: (err) => {
        this.setupSubmitting.set(false);
        const message = err?.error?.message ?? 'Registration failed. Please try again.';
        this.setupError.set(message);
        this.toast.error('Could not create organisation', message);
      },
    });
  }

  goLogin(): void {
    this.router.navigate(['/login']);
  }

  goHome(): void {
    this.orgTheme.reset();
    this.router.navigate(['/']);
  }
}
