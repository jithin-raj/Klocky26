import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IconKlockyLogoComponent } from '../../../../shared/icons/icon-klocky-logo.component';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconKlockyLogoComponent],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss',
})
export class PrivacyPolicyComponent {
  private readonly location = inject(Location);
  readonly lastUpdated = 'July 2026';

  goBack(): void {
    // Opened in a fresh tab (no history) → just close it; otherwise go back.
    if (window.history.length > 1) this.location.back();
    else window.close();
  }
}
