import { describe, expect, it } from 'vitest';
import { FITNESS_DISCIPLINES, validateFitnessValue } from '@fkknv/shared';

const d = (key: string) => FITNESS_DISCIPLINES.find((x) => x.key === key)!;

describe('validateFitnessValue', () => {
  it('nevyžaduje hodnotu (null)', () => expect(validateFitnessValue(d('juggling'), null)).toBeNull());
  it('celé čísla odmietne desatinné', () => expect(validateFitnessValue(d('sitUps30'), 12.5)).not.toBeNull());
  it('desatinné disciplíny prijmú desatinné', () => expect(validateFitnessValue(d('medicineBallThrow'), 7.4)).toBeNull());
  it('odmietne nulu a príliš veľké hodnoty', () => {
    expect(validateFitnessValue(d('shooting'), 0)).not.toBeNull();
    expect(validateFitnessValue(d('shooting'), 1000)).not.toBeNull();
  });
  it('beh 20 m už neexistuje', () => expect(FITNESS_DISCIPLINES.some((x) => x.key === ('run20m' as never))).toBe(false));
});
