export interface Appraisal {
  id: string; userId: string; employeeName: string; cycleName: string;
  status: string; rating?: number; reviewerUserId?: string; dueDate?: string; createdAt: string;
}

export interface CreateAppraisalRequest {
  cycleName: string; employeeIds?: string[]; reviewerUserId?: string; dueDate?: string;
}

export interface PayBand {
  id: string; grade: string; title?: string; minSalary: number; midSalary?: number;
  maxSalary: number; currency?: string; sortOrder: number;
}

export interface PayBandInput {
  grade: string; title?: string; minSalary: number; midSalary?: number;
  maxSalary: number; currency?: string; sortOrder: number;
}

export interface Assessment {
  id: string; title: string; type?: string; description?: string;
  assignedToUserId: string; status: string; score?: number; dueDate?: string; createdAt: string;
}

export interface CreateAssessmentRequest {
  title: string; type?: string; description?: string;
  assignedToEmployeeIds: string[]; dueDate?: string;
}
