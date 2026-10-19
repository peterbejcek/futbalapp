import { describe, expect, it } from 'vitest';
import { planMatchSync, type RecordedEvent } from './match-sync.plan';
import type { SportnetMatchResult } from './sportnet-match.parser';

const OPP = 'opp';
const US = 'us';
function parsed(partial: Partial<SportnetMatchResult>): SportnetMatchResult {
  return {
    homeName: 'Súper',
    awayName: 'FK KNV',
    scoreHome: 0,
    scoreAway: 0,
    teams: [
      { id: OPP, name: 'Súper' },
      { id: US, name: 'FK KNV' },
    ],
    goals: [],
    ...partial,
  };
}
const roster = [
  { id: 'm1', firstName: 'Ján', lastName: 'Novák' },
  { id: 'm2', firstName: 'Peter', lastName: 'Šťastný' },
];
const rec = (id: string, type: string, memberId: string | null, note: string | null = null): RecordedEvent => ({
  id,
  type,
  memberId,
  note,
  minute: 10,
  createdAt: new Date(2026, 0, 1, 0, 0, Number(id.replace(/\D/g, '')) || 0),
});
const label = (id: string) => roster.find((r) => r.id === id)!.lastName;

describe('planMatchSync', () => {
  it('bez rozdielov nič nemení', () => {
    const plan = planMatchSync({
      isHome: false,
      parsed: parsed({ scoreHome: 2, scoreAway: 1, goals: [{ teamId: US, player: 'Novák Ján', minute: 5, penalty: false, ownGoal: false }, { teamId: OPP, player: 'X', minute: 3, penalty: false, ownGoal: false }, { teamId: OPP, player: 'Y', minute: 9, penalty: false, ownGoal: false }] }),
      recorded: [rec('1', 'GOAL', 'm1'), rec('2', 'GOAL_CONCEDED', null), rec('3', 'GOAL_CONCEDED', null)],
      roster,
      memberLabel: label,
    })!;
    expect(plan.changes).toEqual([]);
    expect([plan.scoreUs, plan.scoreThem]).toEqual([1, 2]);
  });

  it('doplní chýbajúceho strelca (aj bez diakritiky a s prehodeným menom) a odstráni zlého', () => {
    const plan = planMatchSync({
      isHome: false,
      parsed: parsed({ scoreHome: 0, scoreAway: 2, goals: [
        { teamId: US, player: 'Stastny Peter', minute: 12, penalty: false, ownGoal: false },
        { teamId: US, player: 'Novák Ján', minute: 30, penalty: true, ownGoal: false },
      ] }),
      recorded: [rec('1', 'GOAL', 'm1')],
      roster,
      memberLabel: label,
    })!;
    expect(plan.add).toMatchObject([{ type: 'GOAL', memberId: 'm2', minute: 12 }]);
    expect(plan.remove).toEqual([]);

    const plan2 = planMatchSync({
      isHome: false,
      parsed: parsed({ scoreHome: 0, scoreAway: 1, goals: [{ teamId: US, player: 'Peter Šťastný', minute: 12, penalty: false, ownGoal: false }] }),
      recorded: [rec('1', 'GOAL', 'm1')],
      roster,
      memberLabel: label,
    })!;
    expect(plan2.add).toHaveLength(1);
    expect(plan2.remove).toEqual([{ id: '1', label: 'Novák' }]);
  });

  it('neúplný zoznam strelcov upraví len počet gólov', () => {
    const plan = planMatchSync({
      isHome: true,
      parsed: parsed({ homeName: 'FK KNV', awayName: 'Súper', teams: [{ id: US, name: 'FK KNV' }, { id: OPP, name: 'Súper' }], scoreHome: 3, scoreAway: 0, goals: [] }),
      recorded: [rec('1', 'GOAL', 'm1')],
      roster,
      memberLabel: label,
    })!;
    expect(plan.add.filter((a) => a.type === 'GOAL')).toHaveLength(2);
    expect(plan.remove).toEqual([]);
  });

  it('bez výsledku vráti null', () => {
    expect(planMatchSync({ isHome: true, parsed: parsed({ scoreHome: null, scoreAway: null }), recorded: [], roster, memberLabel: label })).toBeNull();
  });
});
