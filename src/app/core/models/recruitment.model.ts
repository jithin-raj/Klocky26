export type InterviewMode = 'video'|'in_person'|'phone';
export type InterviewStatus = 'scheduled'|'completed'|'cancelled';

export interface Interview {
  id: string; candidateName: string; position: string | null;
  scheduledAt: string; mode: InterviewMode; status: InterviewStatus; feedbackSubmitted: boolean;
}

export interface InterviewFeedback { feedback: string; status?: 'completed'|'cancelled'; }

export interface CreateInterviewRequest {
  candidateName: string; position?: string; jobPostingId?: string;
  interviewerUserId: string; scheduledAt: string; mode: InterviewMode;
}

export interface Referral {
  id?: string; referredName: string; referredEmail: string; referredPhone?: string;
  positionId?: string; message?: string; status?: string; createdAt?: string;
}

export interface JobPosting {
  id: string; title: string; department?: string; location?: string;
  type: 'full_time'|'part_time'|'contract'; postedAt: string; closingAt?: string; isInternal: boolean;
}

export interface CreateJobPostingRequest {
  title: string; department?: string; location?: string;
  type: 'full_time'|'part_time'|'contract'; isInternal: boolean;
  closingAt?: string; description?: string;
}
