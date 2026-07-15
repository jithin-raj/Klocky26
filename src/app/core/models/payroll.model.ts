// ─────────────────────────────────────────────────────────────────────────────
// Payroll / Payscale — /api/payroll/*. Structured payroll replacing the old
// flat employee.basicSalary/allowances fields (removed).
//
// Permission key 'payroll': 1 = view others, 2 = view + edit. Level 0 hides the
// whole Compensation area. Every employee can always view their OWN payslips
// via the /me endpoints regardless of permission level.
//
// All salary amounts are encrypted at rest server-side — transparent to the FE,
// they arrive as plain numbers.
// ─────────────────────────────────────────────────────────────────────────────

export interface PayrollSettingsDto {
  pfEnabled: boolean;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  pfWageCeiling: number | null;
  esiEnabled: boolean;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  esiGrossThreshold: number;
  ptEnabled: boolean;
  ptMonthlyAmount: number;
  tdsEnabled: boolean;
}

export interface PayrollSettingsRequest {
  pfEnabled: boolean;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  pfWageCeiling?: number | null;
  esiEnabled: boolean;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  esiGrossThreshold: number;
  ptEnabled: boolean;
  ptMonthlyAmount: number;
  tdsEnabled: boolean;
}

export interface PayGradeDto {
  id: string;
  name: string;
  code: string | null;
  minCtc: number;
  midCtc: number;
  maxCtc: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PayGradeUpsertRequest {
  name: string;
  code?: string;
  minCtc: number;
  midCtc: number;
  maxCtc: number;
  isActive?: boolean;
  sortOrder?: number;
}

export type SalaryComponentType = 'earning' | 'deduction';

export interface SalaryComponentDto {
  id: string;
  name: string;
  type: SalaryComponentType;
  monthlyAmount: number;
  isBasic: boolean;
  isTaxable: boolean;
  sortOrder: number;
}

export interface SalaryComponentInput {
  name: string;
  type: SalaryComponentType;
  monthlyAmount: number;
  isBasic?: boolean;
  isTaxable?: boolean;
  sortOrder?: number;
}

export type SalaryStructureReason = 'initial' | 'increment' | 'revision';

export interface SalaryStructureDto {
  id: string;
  userId: string;
  payGradeId: string | null;
  payGradeName: string | null;
  annualCtc: number;
  monthlyGross: number;
  monthlyDeductions: number;
  monthlyNet: number;
  effectiveFrom: string;
  reason: SalaryStructureReason;
  notes: string | null;
  isCurrent: boolean;
  createdAt: string;
  components: SalaryComponentDto[];
}

/** PUT .../structure — creates a new effective-dated version; previous kept as history. */
export interface SetSalaryStructureRequest {
  payGradeId?: string | null;
  effectiveFrom: string;
  reason?: SalaryStructureReason;
  notes?: string;
  components: SalaryComponentInput[];
}

export interface BonusDto {
  id: string;
  userId: string;
  employeeName: string;
  year: number;
  month: number;
  amount: number;
  label: string;
  notes: string | null;
  createdAt: string;
}

export interface BonusRequest {
  userId: string;
  year: number;
  month: number;
  amount: number;
  label?: string;
  notes?: string;
}

export type PayslipLineType = 'earning' | 'deduction' | 'employer';
export type PayslipLineCategory = 'statutory' | 'bonus' | 'lop' | 'standard';

export interface PayslipLineDto {
  name: string;
  type: PayslipLineType;
  category: PayslipLineCategory;
  amount: number;
  sortOrder: number;
}

export interface PayslipDto {
  id: string;
  userId: string;
  employeeName: string;
  year: number;
  month: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerContributions: number;
  payableDays: number;
  lopDays: number;
  daysInMonth: number;
  status: string;
  generatedAt: string;
  lines: PayslipLineDto[];
}

export interface GeneratePayslipRequest {
  year: number;
  month: number;
  userId?: string | null;
}

/** Returned by POST /payslips/generate when userId is omitted (whole-org run). */
export interface PayslipRunResult {
  year: number;
  month: number;
  generated: number;
  skipped: number;
  errors: string[];
}
