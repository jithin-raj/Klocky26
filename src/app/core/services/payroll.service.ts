import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { asArray } from '../utils/api-list.util';
import {
  PayrollSettingsDto, PayrollSettingsRequest,
  PayGradeDto, PayGradeUpsertRequest,
  SalaryStructureDto, SetSalaryStructureRequest,
  BonusDto, BonusRequest,
  PayslipDto, GeneratePayslipRequest, PayslipRunResult,
} from '../models/payroll.model';

// ─────────────────────────────────────────────────────────────────────────────
// PayrollService — /api/payroll/*. Admin endpoints require the 'payroll'
// permission (1=view, 2=edit); self endpoints (/me/*) are open to any employee
// viewing their own payslips regardless of permission level.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly api = inject(ApiService);

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings(): Observable<PayrollSettingsDto> {
    return this.api.get<ApiResponse<PayrollSettingsDto>>('/payroll/settings').pipe(map(res => res.data));
  }

  updateSettings(body: PayrollSettingsRequest): Observable<PayrollSettingsDto> {
    return this.api.put<ApiResponse<PayrollSettingsDto>>('/payroll/settings', body).pipe(map(res => res.data));
  }

  // ── Pay grades ────────────────────────────────────────────────────────────
  getGrades(): Observable<PayGradeDto[]> {
    return this.api.get<ApiResponse<PayGradeDto[] | { data: PayGradeDto[] }>>('/payroll/grades')
      .pipe(map(res => asArray<PayGradeDto>(res.data)));
  }

  createGrade(body: PayGradeUpsertRequest): Observable<PayGradeDto> {
    return this.api.post<ApiResponse<PayGradeDto>>('/payroll/grades', body).pipe(map(res => res.data));
  }

  updateGrade(id: string, body: PayGradeUpsertRequest): Observable<PayGradeDto> {
    return this.api.put<ApiResponse<PayGradeDto>>(`/payroll/grades/${id}`, body).pipe(map(res => res.data));
  }

  deleteGrade(id: string): Observable<void> {
    return this.api.delete<void>(`/payroll/grades/${id}`);
  }

  // ── Salary structure ──────────────────────────────────────────────────────
  getStructure(userId: string): Observable<SalaryStructureDto | null> {
    return this.api.get<ApiResponse<SalaryStructureDto | null>>(`/payroll/employees/${userId}/structure`)
      .pipe(map(res => res.data));
  }

  getStructureHistory(userId: string): Observable<SalaryStructureDto[]> {
    return this.api.get<ApiResponse<SalaryStructureDto[] | { data: SalaryStructureDto[] }>>(`/payroll/employees/${userId}/structure/history`)
      .pipe(map(res => asArray<SalaryStructureDto>(res.data)));
  }

  setStructure(userId: string, body: SetSalaryStructureRequest): Observable<SalaryStructureDto> {
    return this.api.put<ApiResponse<SalaryStructureDto>>(`/payroll/employees/${userId}/structure`, body)
      .pipe(map(res => res.data));
  }

  // ── Bonuses ───────────────────────────────────────────────────────────────
  getBonuses(userId?: string): Observable<BonusDto[]> {
    return this.api.get<ApiResponse<BonusDto[] | { data: BonusDto[] }>>('/payroll/bonuses', userId ? { userId } : undefined)
      .pipe(map(res => asArray<BonusDto>(res.data)));
  }

  createBonus(body: BonusRequest): Observable<BonusDto> {
    return this.api.post<ApiResponse<BonusDto>>('/payroll/bonuses', body).pipe(map(res => res.data));
  }

  deleteBonus(id: string): Observable<void> {
    return this.api.delete<void>(`/payroll/bonuses/${id}`);
  }

  // ── Payslips (admin) ──────────────────────────────────────────────────────
  /** userId omitted → whole-org run (PayslipRunResult); userId set → single PayslipDto. */
  generatePayslips(body: GeneratePayslipRequest): Observable<PayslipDto | PayslipRunResult> {
    return this.api.post<ApiResponse<PayslipDto | PayslipRunResult>>('/payroll/payslips/generate', body)
      .pipe(map(res => res.data));
  }

  getPayslips(year: number, month: number): Observable<PayslipDto[]> {
    return this.api.get<ApiResponse<PayslipDto[] | { data: PayslipDto[] }>>('/payroll/payslips', { year, month })
      .pipe(map(res => asArray<PayslipDto>(res.data)));
  }

  // ── Self (any employee) ───────────────────────────────────────────────────
  getMyPayslips(): Observable<PayslipDto[]> {
    return this.api.get<ApiResponse<PayslipDto[] | { data: PayslipDto[] }>>('/payroll/me/payslips')
      .pipe(map(res => asArray<PayslipDto>(res.data)));
  }

  getMyPayslip(year: number, month: number): Observable<PayslipDto> {
    return this.api.get<ApiResponse<PayslipDto>>(`/payroll/me/payslips/${year}/${month}`).pipe(map(res => res.data));
  }
}
