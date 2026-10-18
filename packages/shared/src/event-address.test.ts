import { describe, expect, it } from 'vitest';
import { createEventSchema, createRecurringTrainingSchema } from './schemas';

const base = { type: 'TRAINING' as const, title: 'Tréning', startAt: '2030-01-01T10:00:00Z' };
const rec = {
  title: 'Tréning',
  teamId: 't1',
  weekdays: [1],
  startTime: '16:00',
  from: '2030-01-01',
  until: '2030-02-01',
};

describe('adresa udalosti', () => {
  it('orezá medzery', () => {
    expect(createEventSchema.parse({ ...base, address: '  Hlavná 1  ' }).address).toBe('Hlavná 1');
  });
  it('prázdny reťazec a null → null', () => {
    expect(createEventSchema.parse({ ...base, address: '   ' }).address).toBeNull();
    expect(createEventSchema.parse({ ...base, address: null }).address).toBeNull();
    expect(createRecurringTrainingSchema.parse({ ...rec, address: '' }).address).toBeNull();
  });
  it('chýbajúca adresa zostane undefined (update ju nemení)', () => {
    expect(createEventSchema.partial().parse({}).address).toBeUndefined();
  });
  it('odmietne > 300 znakov', () => {
    const long = 'x'.repeat(301);
    expect(createEventSchema.safeParse({ ...base, address: long }).success).toBe(false);
    expect(createRecurringTrainingSchema.safeParse({ ...rec, address: long }).success).toBe(false);
    expect(createEventSchema.partial().safeParse({ address: long }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...base, address: 'x'.repeat(300) }).success).toBe(true);
  });
});

describe('adresa plochy', () => {
  it('prijme, orezá a odmietne > 300', async () => {
    const { createPitchSchema } = await import('./schemas');
    const b = { name: 'Ihrisko', surface: 'PT' as const };
    expect(createPitchSchema.parse({ ...b, address: '  Hlavná 1 ' }).address).toBe('Hlavná 1');
    expect(createPitchSchema.parse({ ...b, address: '' }).address).toBeNull();
    expect(createPitchSchema.safeParse({ ...b, address: 'x'.repeat(301) }).success).toBe(false);
  });
});
