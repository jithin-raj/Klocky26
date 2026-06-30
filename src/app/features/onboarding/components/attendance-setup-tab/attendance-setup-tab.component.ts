import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components/ui-select/ui-select.component';

export interface AttendanceSetupData {
  clockInMethods: string[];
  workHoursPerDay: number;
  workWeekStart: string;
  workWeekEnd: string;
  workDayStart: string;
  workDayEnd: string;
  gracePeriod: string;
  halfDayThresholdHrs: number;
  lateThreshold: string;
  locationRule: string;
  overtimeEnabled: boolean;
  overtimeAfterHrs: number;
  requirePhoto: boolean;
  ipRestriction: boolean;
  selfieVerification: boolean;
  autoCheckoutEnabled: boolean;
  autoCheckoutTime: string;
  /** Minutes after workDayEnd before auto clock-out fires (optional override). */
  autoCheckoutBufferMins?: number;
  /** Cooldown between punches, either direction. */
  minPunchGapMins?: number;
}

@Component({
  selector: 'ob-attendance-setup-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSelectComponent],
  templateUrl: './attendance-setup-tab.component.html',
  styleUrl: './attendance-setup-tab.component.scss',
})
export class AttendanceSetupTabComponent {
  @Input() set initialData(v: AttendanceSetupData) {
    const { workDayStart, workDayEnd, ...rest } = v;
    Object.assign(this, rest);
    if (workDayStart) {
      const [h, m] = workDayStart.split(':');
      this.startHour = h ?? '09'; this.startMinute = m ?? '00';
    }
    if (workDayEnd) {
      const [h, m] = workDayEnd.split(':');
      this.endHour = h ?? '18'; this.endMinute = m ?? '00';
    }
  }
  @Output() dataChange = new EventEmitter<AttendanceSetupData>();

  /** Valid clock-in method values — sourced from GET /api/tenant/options by the parent, never hardcoded here. */
  @Input() methodOptions: string[] = [];

  private readonly methodLabels: Record<string, string> = {
    web: 'Web Clock-in',
    mobile: 'Mobile App',
    biometric: 'Biometric Device',
    face: 'Face Recognition',
  };
  methodLabel(value: string): string {
    return this.methodLabels[value] ?? value;
  }

  clockInMethods: string[] = [];
  workHoursPerDay   = 8;
  workWeekStart = 'Monday';
  workWeekEnd   = 'Friday';
  startHour     = '09';
  startMinute   = '00';
  endHour       = '18';
  endMinute     = '00';

  readonly hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  readonly minutes = ['00','05','10','15','20','25','30','35','40','45','50','55'];
  gracePeriod         = '10 mins';
  customGrace         = '';
  showCustomGrace     = false;
  halfDayThresholdHrs = 4;
  lateThreshold       = '';
  locationRule        = '';
  overtimeEnabled     = false;
  overtimeAfterHrs    = 9;
  requirePhoto        = false;
  ipRestriction       = false;
  selfieVerification  = false;
  autoCheckoutEnabled = false;
  autoCheckoutTime    = '20:00';

  readonly weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ];

  readonly gracePresets = ['None', '5 mins', '10 mins', '15 mins', '30 mins', 'Custom'];

  readonly halfDayOptions: { label: string; value: number }[] = [
    { label: '2 hrs', value: 2 },
    { label: '3 hrs', value: 3 },
    { label: '4 hrs', value: 4 },
    { label: '5 hrs', value: 5 },
  ];

  readonly lateThresholds = [
    'After 5 minutes', 'After 10 minutes', 'After 15 minutes',
    'After 30 minutes', 'After 1 hour',
  ];

  readonly locationRules = [
    'No Restriction', 'Office Only (GPS)', 'Geofenced Area',
    'IP Restricted (Office Network)',
  ];

  isMethodSelected(m: string): boolean {
    return this.clockInMethods.includes(m);
  }

  toggleMethod(m: string): void {
    if (this.isMethodSelected(m)) {
      this.clockInMethods = this.clockInMethods.filter(x => x !== m);
    } else {
      this.clockInMethods = [...this.clockInMethods, m];
    }
    this.emit();
  }

  setGrace(preset: string): void {
    if (preset === 'Custom') {
      this.showCustomGrace = true;
      this.gracePeriod = 'Custom';
    } else {
      this.showCustomGrace = false;
      this.gracePeriod = preset;
      this.customGrace = '';
    }
    this.emit();
  }

  get effectiveGrace(): string {
    if (this.showCustomGrace && this.customGrace) {
      return `${this.customGrace} mins`;
    }
    return this.gracePeriod;
  }

  get isValid(): boolean {
    return this.clockInMethods.length > 0 && !!this.locationRule;
  }

  getData(): AttendanceSetupData {
    return {
      clockInMethods:      this.clockInMethods,
      workHoursPerDay:     this.workHoursPerDay,
      workWeekStart:       this.workWeekStart,
      workWeekEnd:         this.workWeekEnd,
      workDayStart:        `${this.startHour}:${this.startMinute}`,
      workDayEnd:          `${this.endHour}:${this.endMinute}`,
      gracePeriod:         this.effectiveGrace,
      halfDayThresholdHrs: this.halfDayThresholdHrs,
      lateThreshold:       this.lateThreshold,
      locationRule:        this.locationRule,
      overtimeEnabled:     this.overtimeEnabled,
      overtimeAfterHrs:    this.overtimeAfterHrs,
      requirePhoto:        this.requirePhoto,
      ipRestriction:       this.ipRestriction,
      selfieVerification:  this.selfieVerification,
      autoCheckoutEnabled: this.autoCheckoutEnabled,
      autoCheckoutTime:    this.autoCheckoutTime,
    };
  }

  emit(): void {
    this.dataChange.emit(this.getData());
  }

  toggle(field: 'requirePhoto' | 'ipRestriction' | 'selfieVerification' | 'overtimeEnabled' | 'autoCheckoutEnabled'): void {
    this[field] = !this[field];
    this.emit();
  }

  stepWorkHours(delta: number): void {
    const next = this.workHoursPerDay + delta;
    if (next >= 1 && next <= 24) { this.workHoursPerDay = next; this.emit(); }
  }

  stepOvertimeHrs(delta: number): void {
    const next = this.overtimeAfterHrs + delta;
    if (next >= 1 && next <= 24) { this.overtimeAfterHrs = next; this.emit(); }
  }
}
