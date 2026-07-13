export const ROLES = ['ADMIN', 'MANAGER', 'COACH', 'PLAYER', 'PARENT'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'GUEST'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED', 'INJURED', 'UNKNOWN'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const EVENT_TYPES = ['TRAINING', 'MATCH', 'TOURNAMENT', 'CLUB_EVENT'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'WAIVED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MATCH_EVENT_TYPES = [
  'GOAL',
  'ASSIST',
  'SUB_IN',
  'SUB_OUT',
  'YELLOW',
  'RED',
  'NOTE',
  'GOAL_CONCEDED',
] as const;
export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

/** Kódy kategórií klubu v poradí od najmladšej. */
export const CATEGORY_CODES = ['U8', 'U9', 'U10', 'U11', 'U13', 'U15', 'U17', 'U19', 'MUZI'] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];
