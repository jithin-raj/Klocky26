import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { OrgSetupData } from '../org-setup-tab/org-setup-tab.component';
import { OptionsService } from '../../../../core/services/options.service';

@Component({
  selector: 'ob-setup-preview-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './setup-preview-tab.component.html',
  styleUrl: './setup-preview-tab.component.scss',
})
export class SetupPreviewTabComponent {
  private readonly optionsSvc = inject(OptionsService);

  @Input() orgData!: OrgSetupData;
  @Input() adminEmail = '';

  /** Resolve an option code to its label for display. */
  label(category: Parameters<OptionsService['labelFor']>[0], code: string): string {
    return this.optionsSvc.labelFor(category, code) || '—';
  }
}
