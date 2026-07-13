import { describe, expect, it } from 'vitest';
import { generateVariableSymbol, parseVariableSymbol, periodLabel } from './payments';

describe('variabilný symbol', () => {
  it('generuje RRMM + 6-miestne poradové číslo člena', () => {
    expect(generateVariableSymbol(42, { year: 2026, month: 9 })).toBe('2609000042');
    expect(generateVariableSymbol(999999, { year: 2027, month: 12 })).toBe('2712999999');
  });

  it('parse je inverzný ku generovaniu', () => {
    const vs = generateVariableSymbol(123, { year: 2026, month: 1 });
    expect(parseVariableSymbol(vs)).toEqual({ year2: 26, month: 1, memberSeq: 123 });
  });

  it('odmietne neplatné vstupy', () => {
    expect(() => generateVariableSymbol(0, { year: 2026, month: 9 })).toThrow();
    expect(() => generateVariableSymbol(1_000_000, { year: 2026, month: 9 })).toThrow();
    expect(() => generateVariableSymbol(1, { year: 2026, month: 13 })).toThrow();
    expect(parseVariableSymbol('abc')).toBeNull();
    expect(parseVariableSymbol('2613000001')).toBeNull(); // mesiac 13
  });

  it('periodLabel formátuje obdobie', () => {
    expect(periodLabel(2026, 9)).toBe('2026-09');
  });
});
