import {
  Component,
  signal,
  ViewChild,
  ElementRef,
  inject,
  OnInit,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UiIconComponent } from '../../../../shared/components';
import { UiInputComponent } from '../../../../shared/components/ui-input/ui-input.component';
import { UiTextareaComponent } from '../../../../shared/components/ui-textarea/ui-textarea.component';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';
import { UiToggleComponent } from '../../../../shared/components/ui-toggle/ui-toggle.component';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal.component';
import { OrgThemeService } from '../../../../core/services/org-theme.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { OrgAuthService } from '../../../../core/services/org-auth.service';
import {
  TenantSettings,
  UpdateTenantSettingsRequest,
  LeaveTypeDto,
  HolidayDto,
} from '../../../../core/models/org-auth.model';
import {
  INDUSTRIES,
  COMPANY_SIZES,
  COUNTRIES,
  TIMEZONE_OPTIONS,
  CURRENCIES,
  DATE_FORMATS,
  WEEK_STARTS,
  COMPANY_TYPES,
  GRACE_PERIOD_OPTIONS,
  HALF_DAY_THRESHOLD_OPTIONS,
  LEAVE_YEAR_MONTHS,
  ACCENT_PRESETS,
  WEEKDAYS,
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

// ── Display ↔ API value conversions ───────────────────────────────────────
// COMPANY_SIZES displays with spaced en-dashes ('51 – 200'); the API enum
// uses plain hyphens ('51-200').
function toApiCompanySize(display: string): string {
  return display.replace(/\s*–\s*/g, '-');
}
function toDisplayCompanySize(api: string): string {
  const match = EMPLOYEE_BANDS.find(b => toApiCompanySize(b) === api);
  return match ?? api;
}

/** A real server-issued GUID — anything else (locally-generated Date.now() ids, mock seed ids) is "new" and should be sent as null so the API creates it fresh. */
function isServerId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const HOLIDAY_TYPE_LABELS: Record<Holiday['type'], string> = {
  national:   'National',
  optional:   'Optional',
  restricted: 'Restricted',
};

@Component({
  selector: 'org-profile',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, UiIconComponent, UiInputComponent, UiTextareaComponent, UiSelectComponent, UiToggleComponent, UiModalComponent],
  templateUrl: './org-profile.component.html',
  styleUrl: './org-profile.component.scss',
})
export class OrgProfileComponent implements OnInit {
  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('colorInput') colorInputRef!: ElementRef<HTMLInputElement>;

  private readonly orgThemeService = inject(OrgThemeService);
  private readonly appState        = inject(AppStateService);
  private readonly orgAuth         = inject(OrgAuthService);
  private readonly fb              = inject(FormBuilder);
  private readonly location        = inject(Location);
  private readonly router          = inject(Router);

  // ── Org-admin step-up (POST /api/org/auth/login) ────────────────────
  // GET/PUT /api/tenant/settings (§1.5c) both require the org-admin token,
  // so the very first load can also need the step-up password — not just
  // save. `_pendingAction` remembers which one to retry once stepped up.
  readonly stepUpOpen       = signal(false);
  readonly stepUpSubmitting = signal(false);
  readonly stepUpError      = signal('');
  readonly stepUpShowPw     = signal(false);
  readonly stepUpForm: FormGroup = this.fb.group({
    password: ['', Validators.required],
  });
  private _pendingAction: 'load' | 'save' = 'load';

  /**
   * Dismiss the step-up dialog. When it gated the initial *load* (nothing is on
   * screen yet) cancelling returns to the previous screen — falling back to the
   * dashboard when there's no in-app history (e.g. a deep link). When it gated a
   * *save*, the page is already populated, so just close it and keep the edits.
   */
  cancelStepUp(): void {
    const wasLoadGate = this._pendingAction === 'load';
    this.stepUpOpen.set(false);
    this.stepUpError.set('');
    this.stepUpShowPw.set(false);
    this.stepUpForm.reset();
    if (!wasLoadGate) return;
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate([`/${this.appState.orgUrlName() || 'default'}`, 'app', 'dashboard']);
    }
  }

  submitStepUp(): void {
    this.stepUpForm.markAllAsTouched();
    if (this.stepUpForm.invalid || this.stepUpSubmitting()) return;
    this.stepUpError.set('');
    this.stepUpSubmitting.set(true);

    this.orgAuth.orgLogin({
      orgSlug: this.appState.orgSlug() ?? '',
      email: this.appState.user()?.email ?? this.primaryEmail,
      password: this.stepUpForm.value.password,
    }).subscribe({
      next: () => {
        this.stepUpSubmitting.set(false);
        this.stepUpOpen.set(false);
        this.stepUpForm.reset();
        if (this._pendingAction === 'save') this._doSave();
        else this._loadSettings();
      },
      error: (err) => {
        this.stepUpSubmitting.set(false);
        this.stepUpError.set(err?.error?.message ?? 'Incorrect password.');
      },
    });
  }

  ngOnInit(): void {
    // Initialize accent color from current theme
    const currentTheme = this.orgThemeService.theme();
    if (currentTheme?.accent) {
      this.accentColor = currentTheme.accent.toLowerCase();
    }

    // GET /api/tenant/options (§1.6) — replace the local country list and
    // the clock-in method choices with the server's; never hardcode the
    // latter, the set of valid methods is the server's to define.
    this.orgAuth.getTenantOptions().subscribe({
      next: (res) => {
        if (res.data.countries?.length) this.countries.set(res.data.countries);
        if (res.data.clockInMethods?.length) this.clockInMethodOptions.set(res.data.clockInMethods);
      },
      error: () => { /* keep the local fallback list */ },
    });

    this._pendingAction = 'load';
    if (this.appState.isOrgAdminAuthenticated()) {
      this._loadSettings();
    } else {
      this.stepUpError.set('');
      this.stepUpOpen.set(true);
    }
  }

  // ── Load (GET /api/tenant/settings) ─────────────────────────────────
  private _loadSettings(): void {
    this.loadingSettings.set(true);
    this.orgAuth.getTenantSettings().subscribe({
      next: (res) => {
        this._applySettings(res.data);
        this.loadingSettings.set(false);
      },
      error: () => { this.loadingSettings.set(false); },
    });
  }

  private _applySettings(s: TenantSettings): void {
    this.companyName  = s.companyName;
    this.legalName    = s.legalName ?? '';
    this.companyType  = s.companyType ?? this.companyType;
    this.foundedYear  = s.foundedYear != null ? String(s.foundedYear) : '';
    this.regNumber    = s.regNumber ?? '';
    this.gstNumber    = s.gstNumber ?? '';
    this.panNumber    = s.panNumber ?? '';
    this.esicNumber   = s.esicNumber ?? '';
    this.pfAccount    = s.pfAccount ?? '';
    this.website      = s.website ?? '';
    this.description  = s.about ?? '';

    this.accentColor  = (s.accentColor || this.accentColor).toLowerCase();
    this._loadedLogoUrl = s.logoUrl ?? '';

    this.primaryEmail     = s.primaryEmail;
    this.secondaryEmails  = [...(s.secondaryEmails ?? [])];
    this.phone             = s.phone ?? '';
    this.billingEmail      = s.billingEmail ?? '';

    this.employeeCount  = toDisplayCompanySize(s.companySize);
    this.industry        = s.industry;
    this.hrContactName   = s.hrContactName ?? '';
    this.hrContactEmail  = s.hrContactEmail ?? '';
    this.country          = s.country;

    this.defaultTimezone = s.defaultTimezone;
    this.dateFormat       = s.dateFormat ?? this.dateFormat;
    this.currency          = s.currency ?? this.currency;
    this.workWeekStartDay = this._capitalize(s.weekStartDay);
    this.workWeekEndDay   = this._capitalize(s.weekEndDay);
    this.weekStart         = this.workWeekStartDay;

    this.workHoursPerDay  = s.workHours;
    this.gracePeriodMins   = s.checkInRuleType === 'none'
      ? 0
      : s.checkInRuleType === 'custom'
        ? (s.checkInCustomMinutes ?? 0)
        : Number(s.checkInRuleType);
    this.halfDayThresholdHrs = s.halfDayThresholdHrs;
    this.overtimeEnabled      = s.overtimeEnabled;
    this.overtimeAfterHrs     = s.overtimeAfterHrs ?? this.overtimeAfterHrs;
    this.geoFencingEnabled    = s.geoFencingEnabled;
    this.selectedClockInMethods = [...(s.clockInMethods ?? [])];
    this.selfieCheckinEnabled = s.selfieVerificationEnabled;
    this.autoCheckoutEnabled  = s.autoCheckoutEnabled;
    this.autoCheckoutTime     = s.autoCheckoutTime ? s.autoCheckoutTime.slice(0, 5) : this.autoCheckoutTime;

    this.leaveYearStart      = this._capitalize(s.leaveYearStart ?? 'january');
    this.annualLeaveDays     = s.annualLeaveDays ?? this.annualLeaveDays;
    this.sickLeaveDays       = s.sickLeaveDays ?? this.sickLeaveDays;
    this.casualLeaveDays     = s.casualLeaveDays ?? this.casualLeaveDays;
    this.carryForwardEnabled = s.carryForwardEnabled;
    this.carryForwardMaxDays = s.carryForwardMaxDays ?? this.carryForwardMaxDays;
    this.compOffEnabled      = s.compOffEnabled;
    this.lopEnabled           = s.lopEnabled;
    this.encashmentEnabled    = s.encashmentEnabled;

    this.customLeaveTypes = (s.leaveTypes ?? []).map(lt => ({
      id: lt.id ?? String(Date.now() + Math.random()),
      name: lt.name,
      daysPerYear: lt.daysPerYear,
      isPaid: lt.isPaid,
      carryForward: lt.carryForward,
      applicableTo: lt.applicableTo,
    }));
    this.holidays = (s.holidays ?? []).map(h => ({
      id: h.id ?? String(Date.now() + Math.random()),
      name: h.name,
      month: h.month,
      day: h.day,
      type: h.type,
    }));
  }

  private _capitalize(v: string): string {
    return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v;
  }

  // ── Reference data ────────────────────────────────────────────
  // Timezone keeps the local {label,value} list (richer than the API's plain
  // string[] — see SERVER_CHANGES_REQUEST.md for the format ambiguity).
  readonly timezones           = TIMEZONES;
  readonly industries          = INDUSTRIES;
  // Countries start from the local constant, replaced by GET /api/tenant/options
  // (§1.6) once it resolves — see ngOnInit.
  readonly countries           = signal<string[]>(COUNTRIES);
  // Clock-in methods — populated from GET /api/tenant/options (§1.6), never hardcoded.
  // Empty until that call resolves; the checkbox group below renders nothing until then.
  readonly clockInMethodOptions = signal<string[]>([]);
  private readonly clockInMethodLabels: Record<string, string> = {
    web: 'Web Clock-in',
    mobile: 'Mobile App',
    biometric: 'Biometric Device',
    face: 'Face Recognition',
  };
  clockInMethodLabel(value: string): string {
    return this.clockInMethodLabels[value] ?? value;
  }
  readonly employeeBands       = EMPLOYEE_BANDS;
  readonly currencies          = CURRENCIES;
  readonly dateFormats         = DATE_FORMATS;
  readonly weekStarts          = WEEK_STARTS;
  readonly weekdays            = WEEKDAYS;
  readonly accentPresets       = ACCENT_PRESETS;
  readonly companyTypes        = COMPANY_TYPES;
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

  // Not yet on this screen's UI — required by the register-complete API (see
  // SERVER_CHANGES_REQUEST.md §2c). Defaulted here until a real control exists.
  country = 'India';

  // Localisation
  defaultTimezone = 'Asia/Kolkata';
  dateFormat      = 'DD/MM/YYYY';
  currency        = 'INR';
  weekStart       = 'Monday';

  // Attendance Policy
  // Two explicit weekdays — matches the registration screen exactly
  // (RegisterComponent.profileForm.workWeekStart/workWeekEnd) and what the
  // API actually models (weekStartDay/weekEndDay, §1.5). Replaces a former
  // 'mon-fri'|'mon-sat'|'mon-sun'|'custom' enum that couldn't represent the
  // same data the registration screen collects, and had no real "custom"
  // backing on the server anyway — see SERVER_CHANGES_REQUEST.md.
  workHoursPerDay      = 8;
  workWeekStartDay     = 'Monday';
  workWeekEndDay       = 'Friday';
  gracePeriodMins      = 10;
  halfDayThresholdHrs  = 4;
  overtimeEnabled      = false;
  overtimeAfterHrs     = 9;
  geoFencingEnabled    = false;
  /** Sourced from GET /api/tenant/options (clockInMethodOptions) — never a hardcoded list. */
  selectedClockInMethods: string[] = [];
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

  /** Last logoUrl returned by the server — no upload endpoint exists yet, so this is passed straight through unchanged on save (see TenantSettings.logoUrl). */
  private _loadedLogoUrl = '';

  // ── UI state (signals) ─────────────────────────────────────────
  readonly isDirty             = signal(false);
  readonly saving              = signal(false);
  readonly loadingSettings     = signal(false);
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

  // ── Clock-in methods (multi-select, options from tenant/options) ──
  isClockInMethodSelected(value: string): boolean {
    return this.selectedClockInMethods.includes(value);
  }

  toggleClockInMethod(value: string): void {
    this.selectedClockInMethods = this.isClockInMethodSelected(value)
      ? this.selectedClockInMethods.filter(v => v !== value)
      : [...this.selectedClockInMethods, value];
    this.markDirty();
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

  /**
   * Org details (§2.3) + org-wide policy defaults (§1.5) both require the
   * org-admin step-up token, not the day-to-day employee token. If we don't
   * have one (or it expired), collect the admin password once before saving.
   */
  save(): void {
    if (!this.appState.isOrgAdminAuthenticated()) {
      this._pendingAction = 'save';
      this.stepUpError.set('');
      this.stepUpOpen.set(true);
      return;
    }
    this._doSave();
  }

  /** Checkbox grace period (0/5/10/15/30) → API's checkInRuleType enum + checkInCustomMinutes. */
  private _toCheckInRule(): { checkInRuleType: any; checkInCustomMinutes: number | null } {
    const mins = this.gracePeriodMins;
    if (mins === 0) return { checkInRuleType: 'none', checkInCustomMinutes: null };
    if ([5, 10, 15, 30].includes(mins)) return { checkInRuleType: String(mins), checkInCustomMinutes: null };
    return { checkInRuleType: 'custom', checkInCustomMinutes: mins };
  }

  private _toLeaveTypeDtos(): LeaveTypeDto[] {
    return this.customLeaveTypes.map(lt => ({
      id: isServerId(lt.id) ? lt.id : null,
      name: lt.name,
      daysPerYear: lt.daysPerYear,
      isPaid: lt.isPaid,
      carryForward: lt.carryForward,
      applicableTo: lt.applicableTo,
    }));
  }

  private _toHolidayDtos(): HolidayDto[] {
    return this.holidays.map(h => ({
      id: isServerId(h.id) ? h.id : null,
      name: h.name,
      month: h.month,
      day: h.day,
      type: h.type,
    }));
  }

  private _doSave(): void {
    this.saving.set(true);
    const { checkInRuleType, checkInCustomMinutes } = this._toCheckInRule();

    const payload: UpdateTenantSettingsRequest = {
      companyName: this.companyName,
      displayName: this.companyName,
      legalName: this.legalName,
      about: this.description,
      companyType: this.companyType,
      foundedYear: this.foundedYear ? Number(this.foundedYear) : null,
      phone: this.phone,
      website: this.website,
      accentColor: this.accentColor,
      logoUrl: this._loadedLogoUrl || null,
      secondaryEmails: this.secondaryEmails.filter(e => e.trim().length > 0),
      billingEmail: this.billingEmail,
      hrContactName: this.hrContactName,
      hrContactEmail: this.hrContactEmail,
      regNumber: this.regNumber,
      gstNumber: this.gstNumber,
      panNumber: this.panNumber,
      esicNumber: this.esicNumber,
      pfAccount: this.pfAccount,
      industry: this.industry,
      companySize: toApiCompanySize(this.employeeCount) as any,
      country: this.country,
      defaultTimezone: this.defaultTimezone,
      dateFormat: this.dateFormat,
      currency: this.currency,
      clockInMethods: (this.selectedClockInMethods.length ? this.selectedClockInMethods : ['web']) as any,
      weekStartDay: this.workWeekStartDay.toLowerCase(),
      weekEndDay: this.workWeekEndDay.toLowerCase(),
      workHours: this.workHoursPerDay,
      checkInRuleType,
      checkInCustomMinutes,
      halfDayThresholdHrs: this.halfDayThresholdHrs,
      locationPolicy: this.geoFencingEnabled ? 'geo_fenced_area' : 'no_restrictions',
      lateThresholdMins: this.gracePeriodMins,
      overtimeEnabled: this.overtimeEnabled,
      overtimeAfterHrs: this.overtimeAfterHrs,
      requirePhotoOnClockIn: false,
      selfieVerificationEnabled: this.selfieCheckinEnabled,
      ipRestrictionEnabled: false,
      autoCheckoutEnabled: this.autoCheckoutEnabled,
      autoCheckoutTime: this.autoCheckoutEnabled && this.autoCheckoutTime ? `${this.autoCheckoutTime}:00` : null,
      geoFencingEnabled: this.geoFencingEnabled,
      geofencePingIntervalMinutes: 5,
      geofenceMissedPingGraceMinutes: 15,
      leaveYearStart: this.leaveYearStart.toLowerCase(),
      annualLeaveDays: this.annualLeaveDays,
      sickLeaveDays: this.sickLeaveDays,
      casualLeaveDays: this.casualLeaveDays,
      carryForwardEnabled: this.carryForwardEnabled,
      carryForwardMaxDays: this.carryForwardMaxDays,
      compOffEnabled: this.compOffEnabled,
      lopEnabled: this.lopEnabled,
      encashmentEnabled: this.encashmentEnabled,
      leaveTypes: this._toLeaveTypeDtos(),
      holidays: this._toHolidayDtos(),
    };

    this.orgAuth.updateTenantSettings(payload).subscribe({
      next: (res) => {
        this._applySettings(res.data);
        const completeTheme = this.orgThemeService.generateThemeFromColor(this.accentColor);
        this.orgThemeService.apply(completeTheme);
        this.saving.set(false);
        this.isDirty.set(false);
      },
      error: () => { this.saving.set(false); },
    });
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
