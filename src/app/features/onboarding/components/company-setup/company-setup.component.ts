import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ViewChild, signal,
} from '@angular/core';
import { OrgSetupTabComponent, OrgSetupData } from '../org-setup-tab/org-setup-tab.component';
import { SetupPreviewTabComponent } from '../setup-preview-tab/setup-preview-tab.component';
import { UiLoaderComponent } from '../../../../shared/components/ui-loader/ui-loader.component';

type SetupTab = 'org' | 'preview';

@Component({
  selector: 'ob-company-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrgSetupTabComponent, SetupPreviewTabComponent, UiLoaderComponent],
  templateUrl: './company-setup.component.html',
  styleUrl: './company-setup.component.scss',
})
export class CompanySetupComponent {
  @Input() adminEmail = '';
  /** True while the final POST /api/org/auth/register call is in flight. */
  @Input() submitting = false;
  @Input() set orgName(name: string) {
    if (name) {
      this.orgData = { ...this.orgData, orgName: name, displayName: name };
    }
  }
  @Output() completed = new EventEmitter<{ org: OrgSetupData }>();

  @ViewChild(OrgSetupTabComponent) orgTab!: OrgSetupTabComponent;

  activeTab = signal<SetupTab>('org');

  orgData: OrgSetupData = {
    orgName: '', displayName: '', emailDomain: '', website: '',
    industry: '', companySize: '', country: '', timezone: '',
    currency: 'INR', dateFormat: '', timeFormat: '', agreed: false,
  };

  readonly tabs: { id: SetupTab; label: string; num: number }[] = [
    { id: 'org',     label: 'Organisation', num: 1 },
    { id: 'preview', label: 'Preview',      num: 2 },
  ];

  isTabDone(id: SetupTab): boolean {
    const order: SetupTab[] = ['org', 'preview'];
    return order.indexOf(id) < order.indexOf(this.activeTab());
  }

  stepLabel(): string {
    const idx = this.tabs.findIndex(t => t.id === this.activeTab());
    return `Step ${idx + 1} of ${this.tabs.length}`;
  }

  canGoNext(): boolean {
    if (this.activeTab() === 'org') return this.orgTab?.isValid ?? false;
    return true;
  }

  next(): void {
    if (this.activeTab() === 'org') {
      this.orgData = this.orgTab.getData();
      this.activeTab.set('preview');
    }
  }

  back(): void {
    if (this.activeTab() === 'preview') this.activeTab.set('org');
  }

  complete(): void {
    if (this.submitting) return;
    this.completed.emit({ org: this.orgData });
  }
}
