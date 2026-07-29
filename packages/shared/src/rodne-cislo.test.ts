import { describe, expect, it } from 'vitest';
import { parseRodneCislo } from './rodne-cislo';

describe('parseRodneCislo', () => {
  it('muž narodený 2015-03-14 (mesiac 03)', () => {
    const r = parseRodneCislo('150314/1234', 2026);
    expect(r).not.toBeNull();
    expect(r!.sex).toBe('M');
    expect(r!.birthDate.toISOString().slice(0, 10)).toBe('2015-03-14');
  });

  it('žena: mesiac +50 (53 → marec, žena)', () => {
    const r = parseRodneCislo('155314/1230', 2026);
    expect(r).not.toBeNull();
    expect(r!.sex).toBe('F');
    expect(r!.birthDate.toISOString().slice(0, 10)).toBe('2015-03-14');
  });

  it('storočie: 85 → 1985 (dospelý)', () => {
    const r = parseRodneCislo('850615/1234', 2026);
    expect(r!.birthDate.getUTCFullYear()).toBe(1985);
  });

  it('akceptuje formát bez lomky', () => {
    expect(parseRodneCislo('1503141234', 2026)).not.toBeNull();
  });

  it('žena +70 (od 2004 pri vyčerpaní): mesiac 71 → január, žena', () => {
    const r = parseRodneCislo('057114/1230', 2026);
    expect(r!.sex).toBe('F');
    expect(r!.birthDate.toISOString().slice(0, 10)).toBe('2005-01-14');
  });

  it('odmietne neplatnú dĺžku', () => {
    expect(parseRodneCislo('1234', 2026)).toBeNull();
  });

  it('odmietne neplatný dátum (31.2.)', () => {
    expect(parseRodneCislo('150231/1234', 2026)).toBeNull();
  });

  it('odmietne neplatný mesiac (13)', () => {
    expect(parseRodneCislo('151331/1234', 2026)).toBeNull();
  });
});
