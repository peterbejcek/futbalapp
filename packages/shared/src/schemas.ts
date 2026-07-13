import { z } from 'zod';
import { ROLES, MEMBER_STATUSES, ATTENDANCE_STATUSES, EVENT_TYPES, MATCH_EVENT_TYPES } from './enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registrationRequestSchema = z.object({
  child: z.object({
    firstName: z.string().min(2).max(60),
    lastName: z.string().min(2).max(60),
    birthDate: z.coerce.date(),
    healthNotes: z.string().max(2000).optional(),
  }),
  parent: z.object({
    firstName: z.string().min(2).max(60),
    lastName: z.string().min(2).max(60),
    email: z.string().email(),
    phone: z.string().min(9).max(20),
    relation: z.enum(['MOTHER', 'FATHER', 'GUARDIAN']),
  }),
  consents: z.object({
    gdpr: z.literal(true, { errorMap: () => ({ message: 'Súhlas so spracovaním údajov je povinný' }) }),
    photos: z.boolean(),
  }),
  note: z.string().max(2000).optional(),
});
export type RegistrationRequestInput = z.infer<typeof registrationRequestSchema>;

export const createMemberSchema = z.object({
  firstName: z.string().min(2).max(60),
  lastName: z.string().min(2).max(60),
  birthDate: z.coerce.date(),
  status: z.enum(MEMBER_STATUSES).default('ACTIVE'),
  futbalnetId: z.string().max(40).optional(),
  healthNotes: z.string().max(2000).optional(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const createEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().min(2).max(120),
  teamCategoryCode: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().max(200).optional(),
  opponent: z.string().max(120).optional(),
  isHome: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const markAttendanceSchema = z.object({
  memberId: z.string(),
  status: z.enum(ATTENDANCE_STATUSES),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const matchEventSchema = z.object({
  clientId: z.string().uuid().describe('Idempotentné ID z klienta pre offline sync'),
  minute: z.number().int().min(0).max(150),
  type: z.enum(MATCH_EVENT_TYPES),
  memberId: z.string().optional(),
  relatedMemberId: z.string().optional(),
  note: z.string().max(500).optional(),
});
export type MatchEventInput = z.infer<typeof matchEventSchema>;

export const assignRoleSchema = z.object({
  role: z.enum(ROLES),
  teamCategoryCode: z.string().optional(),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
