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
  birthDate: z.coerce.date().optional(), // hráči majú dátum, nehráči (rodič/tréner) nemusia
  status: z.enum(MEMBER_STATUSES).default('ACTIVE'),
  futbalnetId: z.string().max(40).optional(),
  healthNotes: z.string().max(2000).optional(),
  /// manuálne zaradenie do družstva (prepíše automatické podľa veku)
  teamId: z.string().optional(),
  /// funkcie/roly člena (na jeho prihlasovacom konte)
  roles: z.array(z.enum(ROLES)).optional(),
  /// vytvorenie/aktualizácia prihlasovacieho konta
  account: z
    .object({
      email: z.string().email(),
      phone: z.string().max(20).optional(),
    })
    .optional(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const createEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().min(2).max(120),
  teamId: z.string().optional(), // null/prázdne = celoklubová udalosť
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().max(200).optional(),
  opponent: z.string().max(120).optional(),
  isHome: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const createRecurringTrainingSchema = z.object({
  title: z.string().min(2).max(120),
  teamId: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  from: z.coerce.date(),
  until: z.coerce.date(),
  location: z.string().max(200).optional(),
});
export type CreateRecurringTrainingInput = z.infer<typeof createRecurringTrainingSchema>;

export const createTeamSchema = z.object({
  teamCategoryCode: z.string().min(1),
  name: z.string().min(1).max(60),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

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
  teamId: z.string().optional(), // scope pre COACH
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
