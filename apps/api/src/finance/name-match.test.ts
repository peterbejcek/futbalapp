import { describe, expect, it } from 'vitest';
import { buildIndex, suggestMemberId } from './name-match';

const members = buildIndex([
  { memberId: 'poliak', firstName: 'Jakub', lastName: 'Poliak', guardianNames: [] },
  { memberId: 'pomietla', firstName: 'Lilly', lastName: 'Pomietlová', guardianNames: [{ firstName: 'Lucia', lastName: 'Pomietlová' }] },
  { memberId: 'vnencak', firstName: 'Patrik', lastName: 'Vnenčák', guardianNames: [{ firstName: 'Petra', lastName: 'Vnenčáková' }] },
  { memberId: 'orosz', firstName: 'Adam', lastName: 'Orosz', guardianNames: [{ firstName: 'Danka', lastName: 'Oroszová' }] },
  { memberId: 'novak', firstName: 'Adam', lastName: 'Novák', guardianNames: [] },
]);

describe('suggestMemberId (reálne prípady z bankového výpisu)', () => {
  it('priezvisko v poznámke + prebytočný text', () => {
    expect(suggestMemberId('Buc Pavol, Bc.', 'Jakub Poliak U13 doplatok', members)).toBe('poliak');
  });
  it('ženské priezvisko platcu (stem)', () => {
    expect(suggestMemberId('Pomietlová Lucia', 'Lilly Pomietlova', members)).toBe('pomietla');
  });
  it('diakritika a ženská koncovka v poznámke', () => {
    expect(suggestMemberId('Petra Vnencakova', 'Patrik Vnencak', members)).toBe('vnencak');
  });
  it('platca s úplne iným priezviskom, dieťa v poznámke', () => {
    expect(suggestMemberId('PALUSAKOVA JANETTE', 'Adam Orosz', members)).toBe('orosz');
  });
  it('zdrobnenina rodiča + priezvisko', () => {
    expect(suggestMemberId('Orosz Daniela', 'Danka Oroszova', members)).toBe('orosz');
  });
  it('nejednoznačné iba krstné meno nevráti návrh', () => {
    // „Adam" je aj Orosz aj Novák a bez priezviska → žiadny návrh
    expect(suggestMemberId('Neznamy Platitel', 'Adam', members)).toBeNull();
  });
  it('žiadna zhoda → null', () => {
    expect(suggestMemberId('H & V INVESTMENT s.r.o.', 'Najom', members)).toBeNull();
  });
});
