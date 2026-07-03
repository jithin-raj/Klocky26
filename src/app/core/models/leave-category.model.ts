export interface LeaveCategory {
  id: string;
  orgId: string;
  name: string;
  code?: string;
  color?: string;
  description?: string;
  daysPerYear: number;
  accrualType: 'upfront' | 'monthly' | 'joining_anniversary' | 'manual';
  accrualDayOfMonth: number;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  carryForwardExpiresAfterDays?: number;
  encashOnLapse: boolean;
  isPaid: boolean;
  isHalfDayAllowed: boolean;
  countWeekendInLeave: boolean;
  countHolidaysInLeave: boolean;
  minDaysPerApplication: number;
  maxConsecutiveDays?: number;
  minAdvanceNoticeDays: number;
  allowBackdatedApplication: boolean;
  backdatedMaxDays?: number;
  documentRequired: boolean;
  documentRequiredAfterDays?: number;
  requiresApproval: boolean;
  approvalFlow: 'manager' | 'hr' | 'manager_then_hr' | 'any_management';
  eligibleAfterDays: number;
  genderEligibility: 'all' | 'male' | 'female' | 'other';
  applicableDepartments: string[];
  applicableOffices: string[];
  applicableRoles: string[];
  allowEncashment: boolean;
  maxEncashmentDaysPerYear: number;
  resetCycle: 'calendar_year' | 'joining_anniversary';
  calendarYearResetMonth: number;
  calendarYearResetDay: number;
  isCompOff: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type LeaveCategoryUpsert = Omit<LeaveCategory, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>;

export interface LeaveCategoryBalance {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  total: number;
  used: number;
  carryForward: number;
  encashed: number;
  remaining: number;
  lapsed: number;
}

export interface CreditDebitRequest {
  employeeIds: string[];
  days: number;
  reason?: string;
  effectiveDate?: string;
}

export interface CarryForwardRequest {
  cycleYear: number;
  categoryIds?: string[];
  dryRun: boolean;
}

export interface CarryForwardResult {
  jobId: string;
  status: string;
  estimatedSeconds: number;
  result: unknown;
}
