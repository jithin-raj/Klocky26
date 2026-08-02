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

/** Statutory figures (PF ceiling / ESI threshold / PT amount) are always monthly —
 *  scaled server-side for weekly payslips. 'weekly' pay periods snap to the org's
 *  existing weekStartDay (org-auth.model.ts TenantSettings.weekStartDay). */
export type PayFrequency = 'monthly' | 'weekly';

export interface PayrollSettingsDto {
  defaultPayFrequency: PayFrequency;
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
  defaultPayFrequency: PayFrequency;
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
  payFrequency: PayFrequency;
  /** Lowercase full weekday name ('monday'..'sunday'), same wire format as
   *  TenantSettings.weekStartDay. Only meaningful when payFrequency is 'weekly'. */
  weekStart: string | null;
}

/** PUT .../structure — creates a new effective-dated version; previous kept as history. */
export interface SetSalaryStructureRequest {
  payGradeId?: string | null;
  effectiveFrom: string;
  reason?: SalaryStructureReason;
  notes?: string;
  components: SalaryComponentInput[];
  payFrequency?: PayFrequency;
  weekStart?: string | null;
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

/** 'draft' = generated but NOT YET PUBLISHED — invisible to the employee via
 *  every /me endpoint (list, single, PDF) until an admin publishes it. */
export type PayslipStatus = 'draft' | 'finalized' | 'paid';

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
  status: PayslipStatus;
  generatedAt: string;
  lines: PayslipLineDto[];
  payFrequency: PayFrequency;
  /** ISO date (YYYY-MM-DD), inclusive — set only when payFrequency is 'weekly'. */
  weekStart: string | null;
  /** ISO date (YYYY-MM-DD), inclusive — set only when payFrequency is 'weekly'. */
  weekEnd: string | null;
  /** true only for the pay-to-date preview (getPreview/getMyPreview) — id is
   *  all-zeros, this is never a real persisted payslip. No PDF/publish for it. */
  isPreview: boolean;
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

/** POST /payslips/weekly/generate — the target week is any date within it; the
 *  server snaps to the org's weekStartDay to find the period's actual boundaries. */
export interface GenerateWeeklyPayslipRequest {
  weekStart: string;
  userId?: string | null;
}

/** Returned by POST /payslips/weekly/generate when userId is omitted (whole-org run). */
export interface WeeklyPayslipRunResult {
  weekStart: string;
  weekEnd: string;
  generated: number;
  skipped: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Payslip template builder — admin drag-and-drop layout used to render every
// payslip PDF. One template per org (GET/PUT /payroll/template); there is no
// separate draft/published state for the template itself (unlike payslips) —
// saving it takes effect on the next PDF render.
// ─────────────────────────────────────────────────────────────────────────────

export type PayslipBlockType = 'heading' | 'field' | 'line-items-table' | 'spacer' | 'logo';

/** One entry in the field palette (GET /payroll/template/fields) — drag this onto the canvas. */
export interface PayslipTemplateFieldDto {
  key: string;
  defaultLabel: string;
  /** Groups the palette, e.g. "Employee" | "Organisation" | "Payslip". */
  category: string;
}

export interface PayslipTemplateBlockInput {
  type: PayslipBlockType;
  /** Required when type === 'field' — must be a key from the field catalog. */
  fieldKey?: string | null;
  /** Required (the heading text) when type === 'heading'; optional label
   *  override for a 'field' block (e.g. "Take-home Pay" instead of "Net Pay"). */
  label?: string | null;
  /** Position in the layout — this IS the drag-reorder result. */
  sortOrder: number;
}

export interface PayslipTemplateBlockDto extends PayslipTemplateBlockInput {
  id: string;
}

export interface UpdatePayslipTemplateRequest {
  blocks: PayslipTemplateBlockInput[];
}

export interface PayslipTemplateDto {
  blocks: PayslipTemplateBlockDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Annual summary — a year's aggregated payslip totals. Self/admin JSON + PDF
// variants, same pairing as payslips. Only PUBLISHED payslips count toward an
// employee's own summary (via /me) — drafts are invisible there just like
// everywhere else on the self-service side.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnualSummaryPeriodDto {
  payslipId: string;
  /** Pre-formatted period label from the server, e.g. "January 2026" or a week's date range. */
  period: string;
  payFrequency: PayFrequency;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

export interface AnnualSummaryDto {
  year: number;
  employeeName: string;
  totalGrossEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  periods: AnnualSummaryPeriodDto[];
}
