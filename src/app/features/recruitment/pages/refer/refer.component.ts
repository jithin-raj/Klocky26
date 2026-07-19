import {
  Component, ChangeDetectionStrategy, signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecruitmentService } from '../../../../core/services/recruitment.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { isValidName, NAME_VALIDATION_MESSAGE } from '../../../../core/utils/name-validation.util';

@Component({
  selector: 'app-refer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './refer.component.html',
  styleUrl: './refer.component.scss',
})
export class ReferComponent {

  private readonly svc   = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  referredName  = signal('');
  referredEmail = signal('');
  referredPhone = signal('');
  message       = signal('');
  submitting    = signal(false);

  readonly nameError = NAME_VALIDATION_MESSAGE;

  get nameInvalid(): boolean {
    return !!this.referredName().trim() && !isValidName(this.referredName());
  }

  get canSubmit(): boolean {
    return !!this.referredName().trim() && !!this.referredEmail().trim() && !this.nameInvalid && !this.submitting();
  }

  submit() {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.svc.createReferral({
      referredName:  this.referredName().trim(),
      referredEmail: this.referredEmail().trim(),
      referredPhone: this.referredPhone().trim() || undefined,
      message:       this.message().trim() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Referral submitted!');
        this.referredName.set('');
        this.referredEmail.set('');
        this.referredPhone.set('');
        this.message.set('');
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error('Could not submit referral', err?.error?.message ?? 'Please try again.');
      },
    });
  }
}
