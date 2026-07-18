// ─────────────────────────────────────────────────────────────────────────────
// AI HR-analytics assistant — GET/POST /api/ai/*. Same bearer auth as the rest
// of the app (employee/admin token, no separate scope).
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/ai/status */
export interface AiStatus {
  /** available = configured && entitled — the only flag the UI needs to decide whether to render. */
  available: boolean;
  /** Deployment has the AI key configured at all. */
  configured: boolean;
  /** Org's plan includes AI (or org is on trial). */
  entitled: boolean;
}

export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export type AiScope = 'organisation' | 'self';

/** POST /api/ai/chat response */
export interface AiChatResponse {
  /** Markdown. */
  answer: string;
  scope: AiScope;
  model: string;
  generatedAt: string;
}

export type AiReportType = 'overview' | 'attendance' | 'leave' | 'performance';

/** POST /api/ai/report response */
export interface AiReportResponse {
  type: AiReportType;
  scope: AiScope;
  title: string;
  /** Markdown — prose only. Never parse numbers out of this; use `metrics` instead. */
  narrative: string;
  /** Grounded structured data the narrative is based on — shape varies by `scope`. Guard every field. */
  metrics: AiOrgMetrics | AiSelfMetrics | Record<string, unknown> | null;
  model: string;
  generatedAt: string;
}

// ── Metrics — grounded data. Every field is optional; the server may omit
// sections that don't apply to a given report `type`. Never assume completeness. ──

export interface AiOrgMetrics {
  scope: 'organisation';
  asOfUtc?: string;
  dashboard?: {
    headcount?: { totalEmployees?: number; admins?: number; departments?: number };
    todayStats?: {
      present?: number; absent?: number; onLeave?: number; late?: number;
      notClockedIn?: number; totalEmployees?: number;
    };
    pending?: { leave?: number; regularization?: number; compOff?: number; total?: number };
    onLeaveToday?: { userId: string; name: string; date: string; type: string }[];
    upcomingBirthdays?: unknown[];
    upcomingHolidays?: unknown[];
  };
  thisCycle?: {
    cycleStart?: string; cycleEnd?: string;
    presentDays?: number; halfDays?: number; absentDays?: number; lateInstances?: number;
    totalWorkedHours?: number; approvedLeaveDays?: number;
    topAbsentees?: { name: string; absentDays: number }[];
  };
}

export interface AiSelfMetrics {
  scope: 'self';
  asOfUtc?: string;
  dashboard?: {
    today?: Record<string, unknown>;
    month?: {
      present?: number; half?: number; absent?: number; onLeave?: number; workedHours?: number;
      [key: string]: unknown;
    };
    leaveBalances?: { type?: string; label?: string; used?: number; total?: number; remaining?: number }[];
    pendingLeaves?: number; pendingRegs?: number; pendingComp?: number; openTasks?: number;
    [key: string]: unknown;
  };
}
