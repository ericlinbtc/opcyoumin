export const USER_ROLES = ['user', 'editor', 'city_admin', 'platform_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const POST_STATUSES = ['draft', 'pending', 'published', 'hidden', 'deleted'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const MODERATION_STATUSES = ['open', 'reviewing', 'approved', 'rejected', 'appealed', 'closed'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const ACTIVITY_STATUSES = ['draft', 'pending', 'published', 'cancelled', 'ended'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const REGISTRATION_STATUSES = ['registered', 'cancelled', 'attended', 'no_show'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const NOTIFICATION_TYPES = ['comment', 'reply', 'reaction', 'follow', 'activity', 'moderation', 'security', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type AuditAction =
  | 'user.role_changed'
  | 'user.banned'
  | 'user.unbanned'
  | 'post.published'
  | 'post.hidden'
  | 'post.restored'
  | 'activity.approved'
  | 'activity.cancelled'
  | 'report.reviewed';
