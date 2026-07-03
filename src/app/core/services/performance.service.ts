import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  Appraisal, CreateAppraisalRequest,
  PayBand, PayBandInput,
  Assessment, CreateAssessmentRequest,
} from '../models/performance.model';

@Injectable({ providedIn: 'root' })
export class PerformanceService {

  private readonly api = inject(ApiService);

  getMyAppraisals(): Observable<Appraisal[]> {
    return this.api.get<ApiResponse<Appraisal[]>>('/performance/appraisals/my')
      .pipe(map(res => res.data ?? []));
  }

  getAllAppraisals(): Observable<Appraisal[]> {
    return this.api.get<ApiResponse<Appraisal[]>>('/performance/appraisals')
      .pipe(map(res => res.data ?? []));
  }

  createAppraisal(body: CreateAppraisalRequest): Observable<Appraisal> {
    return this.api.post<ApiResponse<Appraisal>>('/performance/appraisals', body)
      .pipe(map(res => res.data));
  }

  getPayScale(): Observable<PayBand[]> {
    return this.api.get<ApiResponse<PayBand[]>>('/performance/pay-scale')
      .pipe(map(res => res.data ?? []));
  }

  updatePayScale(bands: PayBandInput[]): Observable<PayBand[]> {
    return this.api.put<ApiResponse<PayBand[]>>('/performance/pay-scale', bands)
      .pipe(map(res => res.data ?? []));
  }

  getMyAssessments(): Observable<Assessment[]> {
    return this.api.get<ApiResponse<Assessment[]>>('/performance/assessments/my')
      .pipe(map(res => res.data ?? []));
  }

  createAssessment(body: CreateAssessmentRequest): Observable<Assessment> {
    return this.api.post<ApiResponse<Assessment>>('/performance/assessments', body)
      .pipe(map(res => res.data));
  }
}
