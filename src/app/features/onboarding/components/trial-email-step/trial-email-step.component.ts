import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthShellComponent } from '../../../auth/components/auth-shell/auth-shell.component';

export interface TrialStartData {
  orgName: string;
  email: string;
}

@Component({
  selector: 'ob-trial-email-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AuthShellComponent],
  template: `
    <klocky-auth-shell>
      <div class="lk-step">

        <div class="lk-eyebrow">
          <span class="lk-dot"></span>
          Register your organisation
        </div>

        <h1 class="lk-heading">
          Create your<br/>
          <span class="lk-heading-accent">workspace.</span>
        </h1>
        <p class="lk-subtext">
          Set up your organisation on Klockk in minutes — no credit card required.
        </p>

        <!-- Organisation name -->
        <div class="lk-field">
          <label class="lk-label" for="trial-org">Organisation name <span style="color:#f87171">*</span></label>
          <div class="lk-input-wrap" [class.lk-input-error]="orgError">
            <svg class="lk-input-icon" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <input
              id="trial-org"
              class="lk-input"
              type="text"
              placeholder="Acme Corporation"
              [(ngModel)]="orgName"
              autocomplete="organization"
            />
          </div>
          @if (orgError) { <p class="lk-error-msg">{{ orgError }}</p> }
        </div>

        <!-- Admin email -->
        <div class="lk-field">
          <label class="lk-label" for="trial-email">Admin email <span style="color:#f87171">*</span></label>
          <div class="lk-input-wrap" [class.lk-input-error]="emailError">
            <svg class="lk-input-icon" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input
              id="trial-email"
              class="lk-input"
              type="email"
              placeholder="admin@company.com"
              [(ngModel)]="email"
              (keydown.enter)="submit()"
              autocomplete="email"
            />
          </div>
          @if (emailError) { <p class="lk-error-msg">{{ emailError }}</p> }
        </div>

        @if (serverError) {
          <p class="lk-error-msg">{{ serverError }}</p>
        }

        <button
          class="lk-btn"
          type="button"
          [disabled]="!orgName.trim() || !email.trim() || submitting"
          (click)="submit()"
        >
          {{ submitting ? 'Sending code…' : 'Get Started' }}
          @if (!submitting) {
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          }
        </button>

        <p class="lk-legal">
          Already have an account?
          <a href="#" (click)="$event.preventDefault(); signIn.emit()">Sign in</a>
        </p>

        <p class="lk-legal" style="margin-top:8px">
          <a href="#" (click)="$event.preventDefault(); goHome.emit()">← Back to home</a>
        </p>

        <p class="lk-legal" style="margin-top:8px">
          By continuing you agree to our
          <a href="#">Terms of Service</a> and <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.
        </p>

      </div>
    </klocky-auth-shell>
  `,
  styleUrl: './trial-email-step.component.scss',
})
export class TrialEmailStepComponent {
  @Output() emailSubmitted = new EventEmitter<TrialStartData>();
  @Output() signIn = new EventEmitter<void>();
  @Output() goHome = new EventEmitter<void>();

  /** Set by the parent while the send-otp call is in flight. */
  @Input() submitting = false;
  /** Set by the parent if send-otp fails (e.g. org/email already taken). */
  @Input() serverError = '';

  orgName    = '';
  email      = '';
  orgError   = '';
  emailError = '';

  submit(): void {
    this.orgError   = '';
    this.emailError = '';

    const org     = this.orgName.trim();
    const trimmed = this.email.trim();

    if (!org) {
      this.orgError = 'Please enter your organisation name.';
      return;
    }

    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      this.emailError = 'Please enter a valid email address.';
      return;
    }

    this.emailSubmitted.emit({ orgName: org, email: trimmed });
  }
}

