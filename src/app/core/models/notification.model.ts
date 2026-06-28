// ─────────────────────────────────────────────────────────────────────────────
// Notification models
//
// In-app notifications shown in the header bell panel and the notifications
// page. The list comes from GET /api/notifications; new ones arrive live over
// SignalR as `notification.created` (user-targeted) — see RealtimeService.
// Admins/HR compose & send via POST /api/notifications.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'info' | 'success' | 'warning'
  | 'attendance' | 'leave' | 'announcement' | 'system';

/** A single in-app notification for the current user. */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** Optional in-app route to open when the notification is clicked. */
  link?: string | null;
}

/**
 * UI-only concept for the composer — which selection mode the sender picked.
 * Each maps to a different field on SendNotificationRequest.
 */
export type NotificationAudience = 'all' | 'employees' | 'department' | 'role';

/**
 * POST /api/notifications/send body (HR/manager/admin only).
 * Recipients = union of userIds + members of departmentIds + holders of
 * orgRoleIds (active only, de-duplicated). `toAll: true` overrides the rest and
 * broadcasts org-wide. `userId` (singular) is kept for backward compatibility.
 * Returns { sentTo, orgWide }.
 */
export interface SendNotificationRequest {
  title: string;
  body: string;
  /** Specific employees. */
  userIds?: string[];
  /** Everyone active in these departments. */
  departmentIds?: string[];
  /** Everyone active holding these roles. */
  orgRoleIds?: string[];
  /** true = whole-org broadcast (overrides the other selections). */
  toAll?: boolean;
  /** Legacy single-recipient field — still accepted by the API. */
  userId?: string | null;
}

/** POST /api/notifications/send response. */
export interface SendNotificationResult {
  sentTo: number;
  orgWide: boolean;
}

/**
 * Defensive mapper — the SignalR push payload and the REST list item may use
 * slightly different field names; normalise both into AppNotification so the UI
 * never has to care which shape arrived.
 */
export function normalizeNotification(raw: any): AppNotification {
  return {
    id: String(raw?.id ?? raw?.notificationId ?? raw?.uuid ?? crypto.randomUUID()),
    title: raw?.title ?? raw?.heading ?? 'Notification',
    body: raw?.body ?? raw?.message ?? raw?.text ?? '',
    type: (raw?.type ?? raw?.category ?? 'info') as NotificationType,
    isRead: !!(raw?.isRead ?? raw?.read ?? false),
    createdAt: raw?.createdAt ?? raw?.sentAt ?? raw?.timestamp ?? new Date().toISOString(),
    link: raw?.link ?? raw?.route ?? null,
  };
}
