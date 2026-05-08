import {
  Component,
  signal,
  ViewChild,
  ElementRef,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiInputComponent } from '../../../../shared/components/ui-input/ui-input.component';
import { UiTextareaComponent } from '../../../../shared/components/ui-textarea/ui-textarea.component';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { UiToggleComponent } from '../../../../shared/components/ui-toggle/ui-toggle.component';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import {
  INDUSTRIES,
  COMPANY_SIZES,
  COUNTRIES,
  TIMEZONE_OPTIONS,
  CURRENCIES,
  DATE_FORMATS,
  WEEK_STARTS,
  COMPANY_TYPES,
  WORKING_DAY_OPTIONS,
  GRACE_PERIOD_OPTIONS,
  HALF_DAY_THRESHOLD_OPTIONS,
  LEAVE_YEAR_MONTHS,
  ACCENT_PRESETS,
} from '../../../../core/config/form-options.const';

export interface Office {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
}

export interface CustomLeaveType {
  id: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  carryForward: boolean;
  applicableTo: 'all' | 'male' | 'female';
}

export interface Holiday {
  id: string;
  name: string;
  month: number;   // 1–12
  day: number;     // 1–31
  type: 'national' | 'optional' | 'restricted';
}

const DEFAULT_HOLIDAYS: Omit<Holiday, 'id'>[] = [
  // Jan
  { name: 'New Year\'s Day',           month: 1,  day: 1,  type: 'national'   },
  { name: 'Republic Day',              month: 1,  day: 26, type: 'national'   },
  // Mar
  { name: 'Holi',                      month: 3,  day: 14, type: 'optional'   },
  // Apr
  { name: 'Good Friday',               month: 4,  day: 18, type: 'optional'   },
  { name: 'Ambedkar Jayanti',          month: 4,  day: 14, type: 'national'   },
  // May
  { name: 'Labour Day',                month: 5,  day: 1,  type: 'optional'   },
  // Aug
  { name: 'Independence Day',          month: 8,  day: 15, type: 'national'   },
  // Oct
  { name: 'Gandhi Jayanti',            month: 10, day: 2,  type: 'national'   },
  { name: 'Dussehra',                  month: 10, day: 2,  type: 'optional'   },
  // Nov
  { name: 'Diwali',                    month: 11, day: 1,  type: 'optional'   },
  // Dec
  { name: 'Christmas Day',             month: 12, day: 25, type: 'national'   },
];

export const TIMEZONES = TIMEZONE_OPTIONS;

const EMPLOYEE_BANDS = COMPANY_SIZES;

const HOLIDAY_TYPE_LABELS: Record<Holiday['type'], string> = {
  national:   'National',
  optional:   'Optional',
  restricted: 'Restricted',
};

@Component({
  selector: 'org-profile',
  standalone: true,
  imports: [FormsModule, UiInputComponent, UiTextareaComponent, UiSelectComponent, UiToggleComponent],
  templateUrl: './org-profile.component.html',
  styleUrl: './org-profile.component.scss',
})
export class OrgProfileComponent implements OnInit {
  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('colorInput') colorInputRef!: ElementRef<HTMLInputElement>;

  private readonly orgThemeService = inject(OrgThemeService);

  ngOnInit(): void {
    // Initialize accent color from current theme
    const currentTheme = this.orgThemeService.theme();
    if (currentTheme?.accent) {
      this.accentColor = currentTheme.accent.toLowerCase();
    }
  }

  // ── Reference data ────────────────────────────────────────────
  readonly timezones           = TIMEZONES;
  readonly industries          = INDUSTRIES;
  readonly countries           = COUNTRIES;
  readonly employeeBands       = EMPLOYEE_BANDS;
  readonly currencies          = CURRENCIES;
  readonly dateFormats         = DATE_FORMATS;
  readonly weekStarts          = WEEK_STARTS;
  readonly accentPresets       = ACCENT_PRESETS;
  readonly companyTypes        = COMPANY_TYPES;
  readonly workingDayOptions   = WORKING_DAY_OPTIONS;
  readonly gracePeriodOptions  = GRACE_PERIOD_OPTIONS;
  readonly halfDayOptions      = HALF_DAY_THRESHOLD_OPTIONS;
  readonly leaveYearMonths     = LEAVE_YEAR_MONTHS;
  readonly holidayTypeLabels   = HOLIDAY_TYPE_LABELS;
  readonly allMonths = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  // ── Form state (plain props for ngModel compatibility) ─────────

  // Identity
  companyName  = 'Acme Technologies';
  legalName    = 'Acme Technologies Private Limited';
  companyType  = 'Private Limited';
  foundedYear  = '';
  regNumber    = '';
  gstNumber    = '';
  panNumber    = '';
  esicNumber   = '';
  pfAccount    = '';
  website      = 'https://acme.com';
  description  = '';

  // Branding
  accentColor  = '#6366f1';

  // Contact
  primaryEmail     = 'admin@acme.com';
  secondaryEmails: string[] = [];
  phone            = '';
  billingEmail     = '';

  // Offices
  offices: Office[] = [
    {
      id: '1',
      name: 'Headquarters',
      address: '123 Main Street',
      city: 'Mumbai',
      country: 'India',
      timezone: 'Asia/Kolkata',
    },
  ];

  // Team
  employeeCount  = '51–200';
  industry       = 'Technology';
  hrContactName  = '';
  hrContactEmail = '';

  // Localisation
  defaultTimezone = 'Asia/Kolkata';
  dateFormat      = 'DD/MM/YYYY';
  currency        = 'INR';
  weekStart       = 'Monday';

  // Attendance Policy
  workHoursPerDay      = 8;
  workingDays          = 'mon-fri';
  gracePeriodMins      = 10;
  halfDayThresholdHrs  = 4;
  overtimeEnabled      = false;
  overtimeAfterHrs     = 9;
  geoFencingEnabled    = false;
  remoteCheckinEnabled = true;
  selfieCheckinEnabled = false;
  autoCheckoutEnabled  = false;
  autoCheckoutTime     = '20:00';

  // Leave & Holidays
  leaveYearStart       = 'January';
  annualLeaveDays      = 18;
  sickLeaveDays        = 12;
  casualLeaveDays      = 6;
  carryForwardEnabled  = true;
  carryForwardMaxDays  = 5;
  compOffEnabled       = true;
  lopEnabled           = true;
  encashmentEnabled    = false;

  customLeaveTypes: CustomLeaveType[] = [
    { id: '1', name: 'Maternity Leave',  daysPerYear: 182, isPaid: true,  carryForward: false, applicableTo: 'female' },
    { id: '2', name: 'Paternity Leave',  daysPerYear: 5,   isPaid: true,  carryForward: false, applicableTo: 'male'   },
    { id: '3', name: 'Bereavement Leave',daysPerYear: 3,   isPaid: true,  carryForward: false, applicableTo: 'all'   },
    { id: '4', name: 'Marriage Leave',   daysPerYear: 3,   isPaid: true,  carryForward: false, applicableTo: 'all'   },
  ];

  holidays: Holiday[] = DEFAULT_HOLIDAYS.map((h, i) => ({ ...h, id: String(i + 1) }));

  // ── UI state (signals) ─────────────────────────────────────────
  readonly isDirty             = signal(false);
  readonly saving              = signal(false);
  readonly logoPreview         = signal('');
  readonly activeSection       = signal('identity');
  readonly showDiscardConfirm  = signal(false);
  readonly holidayMonth        = signal(1);  // 1–12, currently viewed month
  readonly colorWarning        = signal('');  // Warning for light colors

  markDirty(): void {
    this.isDirty.set(true);
  }

  // ── Logo ───────────────────────────────────────────────────────
  triggerLogo(): void {
    this.logoInputRef.nativeElement.click();
  }

  onLogoSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.logoPreview.set(URL.createObjectURL(file));
      this.markDirty();
    }
  }

  removeLogo(): void {
    this.logoPreview.set('');
    this.markDirty();
  }

  // ── Accent color ───────────────────────────────────────────────
  setAccentColor(color: string): void {
    this.accentColor = color.toLowerCase();
    this._checkColorBrightness(color);
    this.markDirty();
  }

  isColorSelected(color: string): boolean {
    return this.accentColor.toLowerCase() === color.toLowerCase();
  }

  openColorPicker(): void {
    this.colorInputRef.nativeElement.value = this.accentColor;
    this.colorInputRef.nativeElement.click();
  }

  onCustomColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.accentColor = color.toLowerCase();
    this._checkColorBrightness(color);
    this.markDirty();
  }

  /**
   * Check if the selected color is too light and show a warning
   */
  private _checkColorBrightness(hex: string): void {
    const luminance = this._getLuminance(hex);
    if (luminance > 0.85) {
      this.colorWarning.set('⚠️ Very light color detected. For the best UI experience, we recommend selecting a darker, more vibrant color instead of white or near-white shades.');
    } else if (luminance > 0.7) {
      this.colorWarning.set('💡 Light color selected. Theme will automatically adapt to ensure good contrast and readability.');
    } else {
      this.colorWarning.set('');
    }
  }

  /**
   * Calculate relative luminance of a color (0 = black, 1 = white)
   */
  private _getLuminance(hex: string): number {
    const rgb = this._hexToRgb(hex);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      const normalized = val / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private _hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    const int = parseInt(clean, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    };
  }

  /**
   * Get preview theme generated from the selected accent color
   */
  private _previewTheme: any = null;
  private _lastAccentColor = '';

  getPreviewTheme(): any {
    // Always use the selected accent color for the preview (not the applied theme)
    const currentColor = this.accentColor;
    
    if (currentColor !== this._lastAccentColor) {
      this._lastAccentColor = currentColor;
      const luminance = this._getLuminance(currentColor);
      const isLight = luminance > 0.5;
      
      this._previewTheme = {
        accent: currentColor,
        pageBg: isLight ? '#ffffff' : '#0a1214',
        textColor: isLight ? '#1e293b' : '#f8fafc',
        textColorMuted: isLight ? 'rgba(30, 41, 59, 0.6)' : 'rgba(248, 250, 252, 0.6)',
        btnTextColor: luminance > 0.5 ? '#1e293b' : '#ffffff',
      };
    }
    return this._previewTheme;
  }

  getPreviewBg(): string {
    return this.getPreviewTheme().pageBg;
  }

  /**
   * Get text color for preview based on background
   */
  getTextColor(opacity: number = 1): string {
    const theme = this.getPreviewTheme();
    return opacity === 1 ? theme.textColor : theme.textColorMuted;
  }

  /**
   * Get button text color based on accent brightness
   */
  getBtnTextColor(): string {
    return this.getPreviewTheme().btnTextColor;
  }

  /**
   * Get logo background color with proper contrast (for form logo preview)
   */
  getLogoBackground(): string {
    // Always use the selected accent color (not the applied theme)
    const currentColor = this.accentColor;
    const luminance = this._getLuminance(currentColor);
    // If accent is very light, darken the logo background
    if (luminance > 0.7) {
      return this._adjustBrightness(currentColor, -0.3);
    }
    // If accent is dark, lighten slightly for depth
    return this._adjustBrightness(currentColor, 0.1);
  }

  /**
   * Get logo text color with guaranteed visibility
   */
  getLogoTextColor(): string {
    const bgLuminance = this._getLuminance(this.getLogoBackground());
    return bgLuminance > 0.5 ? '#1e293b' : '#ffffff';
  }

  /**
   * Adjust brightness helper for logo
   */
  private _adjustBrightness(hex: string, percent: number): string {
    const rgb = this._hexToRgb(hex);
    
    const adjust = (val: number) => {
      if (percent > 0) {
        return Math.min(255, Math.round(val + (255 - val) * percent));
      } else {
        return Math.max(0, Math.round(val * (1 + percent)));
      }
    };

    const r = adjust(rgb.r);
    const g = adjust(rgb.g);
    const b = adjust(rgb.b);
    
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }

  // ── Secondary emails ───────────────────────────────────────────
  addSecondaryEmail(): void {
    this.secondaryEmails = [...this.secondaryEmails, ''];
    this.markDirty();
  }

  removeSecondaryEmail(index: number): void {
    this.secondaryEmails = this.secondaryEmails.filter((_, i) => i !== index);
    this.markDirty();
  }

  // ── Offices ────────────────────────────────────────────────────
  addOffice(): void {
    this.offices = [
      ...this.offices,
      { id: Date.now().toString(), name: '', address: '', city: '', country: '', timezone: '' },
    ];
    this.markDirty();
  }

  removeOffice(id: string): void {
    this.offices = this.offices.filter(o => o.id !== id);
    this.markDirty();
  }

  // ── Custom leave types ───────────────────────────────────────
  addCustomLeave(): void {
    this.customLeaveTypes = [
      ...this.customLeaveTypes,
      { id: Date.now().toString(), name: '', daysPerYear: 0, isPaid: true, carryForward: false, applicableTo: 'all' },
    ];
    this.markDirty();
  }

  removeCustomLeave(id: string): void {
    this.customLeaveTypes = this.customLeaveTypes.filter(l => l.id !== id);
    this.markDirty();
  }

  // ── Holidays ──────────────────────────────────────────────
  holidaysForMonth(month: number): Holiday[] {
    return this.holidays
      .filter(h => h.month === month)
      .sort((a, b) => a.day - b.day);
  }

  totalHolidaysForMonth(month: number): number {
    return this.holidays.filter(h => h.month === month).length;
  }

  addHoliday(): void {
    const m = this.holidayMonth();
    this.holidays = [
      ...this.holidays,
      { id: Date.now().toString(), name: '', month: m, day: 1, type: 'national' },
    ];
    this.markDirty();
  }

  removeHoliday(id: string): void {
    this.holidays = this.holidays.filter(h => h.id !== id);
    this.markDirty();
  }

  daysInMonth(month: number): number[] {
    const days = new Date(new Date().getFullYear(), month, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  }

  // ── Theme Testing ─────────────────────────────────────────────────
  /**
   * Test the theme by applying it to the app temporarily (before saving)
   */
  testTheme(): void {
    const completeTheme = this.orgThemeService.generateThemeFromColor(this.accentColor);
    this.orgThemeService.apply(completeTheme);
    
    console.log('🎨 Testing theme:', {
      accentColor: this.accentColor,
      generatedTheme: completeTheme
    });
  }

  // ── Save / Discard ─────────────────────────────────────────────
  async save(): Promise<void> {
    this.saving.set(true);
    
    try {
      // ────────────────────────────────────────────────────────────
      // API Integration Example:
      // Only send the accent color to your backend
      // ────────────────────────────────────────────────────────────
      const payload = {
        companyName: this.companyName,
        brandColor: this.accentColor,  // Single color! 🎨
        // ... other org profile fields
      };
      
      // await this.apiService.updateOrgProfile(payload);
      await new Promise(r => setTimeout(r, 900)); // Simulated API call
      
      // ────────────────────────────────────────────────────────────
      // After save: Generate complete theme and apply it
      // ────────────────────────────────────────────────────────────
      const completeTheme = this.orgThemeService.generateThemeFromColor(this.accentColor);
      this.orgThemeService.apply(completeTheme);
      
      // Optional: Log to see the auto-generated colors
      console.log('Generated theme from single color:', completeTheme);
      
      this.saving.set(false);
      this.isDirty.set(false);
    } catch (error) {
      this.saving.set(false);
      console.error('Failed to save org profile:', error);
    }
  }

  discard(): void {
    if (this.isDirty()) {
      this.showDiscardConfirm.set(true);
    }
  }

  confirmDiscard(): void {
    this.showDiscardConfirm.set(false);
    this.isDirty.set(false);
  }

  cancelDiscard(): void {
    this.showDiscardConfirm.set(false);
  }

  // ── Section navigation ─────────────────────────────────────────
  setSection(section: string): void {
    this.activeSection.set(section);
  }
}
