import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import {
  Interview, InterviewFeedback, CreateInterviewRequest,
  Referral, JobPosting, CreateJobPostingRequest,
} from '../models/recruitment.model';

@Injectable({ providedIn: 'root' })
export class RecruitmentService {

  private readonly api = inject(ApiService);

  getMyInterviews(): Observable<Interview[]> {
    return this.api.get<ApiResponse<Interview[]>>('/recruitment/my-interviews')
      .pipe(map(res => res.data ?? []));
  }

  submitFeedback(id: string, body: InterviewFeedback): Observable<Interview> {
    return this.api.put<ApiResponse<Interview>>(`/recruitment/interviews/${id}/feedback`, body)
      .pipe(map(res => res.data));
  }

  createInterview(body: CreateInterviewRequest): Observable<Interview> {
    return this.api.post<ApiResponse<Interview>>('/recruitment/interviews', body)
      .pipe(map(res => res.data));
  }

  createReferral(body: Omit<Referral, 'id'|'status'|'createdAt'>): Observable<Referral> {
    return this.api.post<ApiResponse<Referral>>('/recruitment/referrals', body)
      .pipe(map(res => res.data));
  }

  getMyReferrals(): Observable<Referral[]> {
    return this.api.get<ApiResponse<Referral[]>>('/recruitment/referrals/my')
      .pipe(map(res => res.data ?? []));
  }

  getJobs(): Observable<JobPosting[]> {
    return this.api.get<ApiResponse<JobPosting[]>>('/recruitment/jobs')
      .pipe(map(res => res.data ?? []));
  }

  createJob(body: CreateJobPostingRequest): Observable<JobPosting> {
    return this.api.post<ApiResponse<JobPosting>>('/recruitment/jobs', body)
      .pipe(map(res => res.data));
  }
}
