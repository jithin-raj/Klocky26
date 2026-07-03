export interface TimeOverview {
  date: string;
  status: 'present' | 'absent' | 'on_leave' | 'wfh';
  punchMethod: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  workDurationMinutes: number;
  pendingRequests: { id: string; type: 'leave' | 'regularization'; status: string; from: string; to: string }[];
  upcomingHolidays: { id: string; name: string; date: string; isOptional: boolean }[];
  attendanceMetrics: { presentDays: number; absentDays: number; latePunches: number; avgWorkHoursThisMonth: number };
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
  applicableOffices: string[];
}

export interface UpcomingEventItem {
  type: 'holiday' | 'birthday';
  title: string;
  date: string;
  employeeId: string | null;
  employeeName: string | null;
}
