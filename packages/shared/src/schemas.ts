import { z } from 'zod';
import { ROLES, MEMBER_STATUSES, ATTENDANCE_STATUSES, EVENT_TYPES, MATCH_EVENT_TYPES, SURFACE_CODES } from './enums';
import { parseRodneCislo } from './rodne-cislo';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registrationRequestSchema = z
  .object({
    // CHILD = dieťa (vypĺňa rodič), ADULT = dospelý/starší hráč sám za seba
    applicantType: z.enum(['CHILD', 'ADULT']),
    player: z.object({
      firstName: z.string().min(2).max(60),
      lastName: z.string().min(2).max(60),
      // rodné číslo je povinné; dátum narodenia sa z neho odvodí
      birthNumber: z
        .string()
        .min(9)
        .max(11)
        .refine((v) => parseRodneCislo(v) !== null, { message: 'Neplatné rodné číslo' }),
      birthDate: z.coerce.date().optional(), // odvodené z rodného čísla (server je autorita)
      // registračné číslo (hráč ho ešte nemusí mať pridelené)
      registrationNumber: z.string().max(40).optional(),
      // fotka hráča ako data URL (voliteľná)
      photoBase64: z.string().max(6_000_000).optional(),
      healthNotes: z.string().max(2000).optional(),
      // vlastné prihlásenie hráča (povinné pre dospelého, voliteľné pre staršie dieťa)
      email: z.string().email().optional(),
    }),
    originCountry: z.string().max(60).optional(),
    address: z.object({
      street: z.string().min(2).max(120),
      houseNumber: z.string().min(1).max(20),
      zip: z.string().min(4).max(10),
      city: z.string().min(2).max(120),
    }),
    parent: z
      .object({
        firstName: z.string().min(2).max(60),
        lastName: z.string().min(2).max(60),
        email: z.string().email(),
        phone: z.string().min(9).max(20),
        relation: z.enum(['MOTHER', 'FATHER', 'GUARDIAN']),
      })
      .optional(),
    consents: z.object({
      gdpr: z.literal(true, { errorMap: () => ({ message: 'Súhlas so spracovaním údajov je povinný' }) }),
      photos: z.boolean(),
    }),
    note: z.string().max(2000).optional(),
  })
  .refine((d) => d.applicantType !== 'CHILD' || !!d.parent, {
    message: 'Pri registrácii dieťaťa sú údaje rodiča povinné',
    path: ['parent'],
  })
  .refine((d) => d.applicantType !== 'ADULT' || !!d.player.email, {
    message: 'Dospelý hráč potrebuje e-mail pre vlastné prihlásenie',
    path: ['player', 'email'],
  });
export type RegistrationRequestInput = z.infer<typeof registrationRequestSchema>;

export const createMemberSchema = z.object({
  firstName: z.string().min(2).max(60),
  lastName: z.string().min(2).max(60),
  birthDate: z.coerce.date().optional(), // hráči majú dátum, nehráči (rodič/tréner) nemusia
  status: z.enum(MEMBER_STATUSES).default('ACTIVE'),
  futbalnetId: z.string().max(40).optional(),
  healthNotes: z.string().max(2000).optional(),
  /// sociálny prípad — hráčovi sa nevytvára poplatok (len vedúci)
  socialCase: z.boolean().optional(),
  /// úroveň trénerskej licencie
  licenseLevel: z.enum(['A_PRO', 'A', 'B', 'C', 'GK']).optional(),
  /// registračný preukaz / futbalnet
  registrationNumber: z.string().max(40).optional(),
  homeClub: z.string().max(120).optional(),
  guestClub: z.string().max(120).optional(),
  clubAffiliation: z.string().max(120).optional(),
  registrationValidUntil: z.coerce.date().optional(),
  registeredAt: z.coerce.date().optional(),
  /// manuálne zaradenie do družstva (prepíše automatické podľa veku)
  teamId: z.string().optional(),
  /// manuálne zaradenie do viacerých skupín naraz (nahrádza teamId)
  teamIds: z.array(z.string()).optional(),
  /// funkcie/roly člena (na jeho prihlasovacom konte)
  roles: z.array(z.enum(ROLES)).optional(),
  /// vytvorenie/aktualizácia prihlasovacieho konta
  account: z
    .object({
      email: z.string().email(),
      phone: z.string().max(20).optional(),
    })
    .optional(),
  /// priradenie detí rodičovi (vytvorí väzbu Guardian; vyžaduje konto)
  childMemberIds: z.array(z.string()).optional(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const createEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().min(2).max(120),
  teamId: z.string().optional(), // null/prázdne = celoklubová udalosť
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().max(200).optional(),
  surface: z.enum(SURFACE_CODES).optional(),
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
  surface: z.enum(SURFACE_CODES).optional(),
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
  stoppage: z.number().int().min(0).max(30).optional(),
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
