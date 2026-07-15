import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject, signal, computed, OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { OptionsService } from '../../../../core/services/options.service';

export interface OrgSetupData {
  orgName: string;
  displayName: string;
  emailDomain: string;
  website: string;
  // All codes from GET /api/options.
  industry: string;
  companySize: string;
  country: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  /** DPDP consent — must be true to proceed. */
  agreed: boolean;
}

@Component({
  selector: 'ob-org-setup-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSelectComponent],
  templateUrl: './org-setup-tab.component.html',
  styleUrl: './org-setup-tab.component.scss',
})
export class OrgSetupTabComponent implements OnInit {
  private readonly optionsSvc = inject(OptionsService);

  @Input() set initialData(v: OrgSetupData) { if (v) Object.assign(this, v); }
  @Output() dataChange = new EventEmitter<OrgSetupData>();

  orgName     = '';
  displayName = '';
  emailDomain = '';
  website     = '';
  industry    = '';
  companySize = '';
  country     = '';
  timezone    = '';
  currency    = 'INR';
  dateFormat  = '';
  timeFormat  = '';
  agreed      = false;

  /** Options loaded → drives all the dropdowns. */
  private readonly _tick = signal(0);
  readonly industryOptions   = computed(() => (this._tick(), this.optionsSvc.selectOptions('industry')));
  readonly companySizeOptions = computed(() => (this._tick(), this.optionsSvc.selectOptions('company_size')));
  readonly countryOptions    = computed(() => (this._tick(), this.optionsSvc.selectOptions('country')));
  readonly timezoneOptions   = computed(() => (this._tick(), this.optionsSvc.selectOptions('timezone')));
  readonly currencyOptions   = computed(() => (this._tick(), this.optionsSvc.selectOptions('currency')));
  readonly dateFormatOptions = computed(() => (this._tick(), this.optionsSvc.selectOptions('date_format')));
  readonly timeFormatOptions = computed(() => (this._tick(), this.optionsSvc.selectOptions('time_format')));

  ngOnInit(): void {
    this.optionsSvc.ensureLoaded().subscribe(() => {
      // Apply sensible defaults from the loaded catalogue where empty.
      if (!this.currency) this.currency = this.optionsSvc.get('currency').some(o => o.code === 'INR') ? 'INR' : (this.optionsSvc.get('currency')[0]?.code ?? '');
      if (!this.dateFormat) this.dateFormat = this.optionsSvc.get('date_format')[0]?.code ?? '';
      if (!this.timeFormat) this.timeFormat = this.optionsSvc.get('time_format')[0]?.code ?? '';
      this._tick.update(v => v + 1);
      this.emit();
    });
  }

  /** When a country is chosen, auto-select its default timezone (still editable). */
  onCountryChange(): void {
    const tz = this.optionsSvc.defaultTimezoneForCountry(this.country);
    if (tz) this.timezone = tz;
    this.emit();
  }

  get isValid(): boolean {
    return !!(this.orgName.trim() && this.displayName.trim() &&
              this.industry && this.companySize && this.country && this.timezone &&
              this.currency && this.dateFormat && this.timeFormat && this.agreed);
  }

  getData(): OrgSetupData {
    return {
      orgName:     this.orgName.trim(),
      displayName: this.displayName.trim(),
      emailDomain: this.emailDomain.trim(),
      website:     this.website.trim(),
      industry:    this.industry,
      companySize: this.companySize,
      country:     this.country,
      timezone:    this.timezone,
      currency:    this.currency,
      dateFormat:  this.dateFormat,
      timeFormat:  this.timeFormat,
      agreed:      this.agreed,
    };
  }

  emit(): void {
    this.dataChange.emit(this.getData());
  }
}
