import type { CategoryCode } from '@fkknv/shared';
import type { EventQuery, PublicArticle, PublicDataSource, PublicEvent, PublicPlayer, TeamView } from '../types';

const CATEGORIES: Array<[CategoryCode, string, string[]]> = [
  ['U8', 'Prípravka U8', ['U8']],
  ['U9', 'Prípravka U9', ['U9']],
  ['U10', 'Prípravka U10', ['U10']],
  ['U11', 'Prípravka U11', ['U11']],
  ['U13', 'Mladší žiaci U13', ['U13 A', 'U13 B']],
  ['U15', 'Starší žiaci U15', ['U15 A', 'U15 B']],
  ['U17', 'Mladší dorast U17', ['U17']],
  ['U19', 'Starší dorast U19', ['U19']],
  ['MUZI', 'Muži', ['MUZI']],
];

const TEAMS: TeamView[] = CATEGORIES.flatMap(([categoryCode, categoryName, names], ci) =>
  names.map((name, i) => ({ id: `demo-team-${name.replace(/\s/g, '').toLowerCase()}`, categoryCode, categoryName, name, sortOrder: ci * 10 + i })),
);
const team = (name: string) => TEAMS.find((t) => t.name === name)!;

const HERO = '/verejne/hero-blue-crest.png';
const SQUADS: Record<string, PublicPlayer[]> = {
  'U15 A': [
    { id: 'demo-p1', firstName: 'Adam', lastName: 'Vetranský', shirtNumber: 10, position: 'Stredopoliar', photoUrl: HERO, photoPosition: '62% 20%' },
    { id: 'demo-p2', firstName: 'Oliver', lastName: 'Rovenský', shirtNumber: 7, position: 'Útočník', photoUrl: HERO, photoPosition: '84% 25%' },
    { id: 'demo-p3', firstName: 'Filip', lastName: 'Borinský', shirtNumber: 4, position: 'Obranca', photoUrl: HERO, photoPosition: '99% 25%' },
    // ukážka hráča BEZ súhlasu s fotkou: zobrazí sa iba meno a priezvisko
    { id: 'demo-p4', firstName: 'Samuel', lastName: 'Kuruc', shirtNumber: 1, position: 'Brankár', photoUrl: null },
  ],
};

const e = (id: number, tm: string, type: PublicEvent['type'], day: number, hm: string, title: string, location: string, match?: PublicEvent['match']): PublicEvent => {
  const t = team(tm);
  return { id: `demo-e${id}`, type, teamId: t.id, categoryCode: t.categoryCode, teamName: t.name, title, startAt: `2026-10-${String(day).padStart(2, '0')}T${hm}:00+02:00`, location, match: match ?? null };
};
const home = 'Ihrisko FK KNV · Agátová';
const EVENTS: PublicEvent[] = [
  e(1, 'U15 A', 'MATCH', 17, '10:00', 'FK KNV — MFK Rožňava', home, { opponent: 'MFK Rožňava', isHome: true, state: 'PLANNED' }),
  e(2, 'U13 A', 'MATCH', 18, '10:30', 'FK KNV — FA Benecol', 'Ihrisko súpera · Košice', { opponent: 'FA Benecol', isHome: false, state: 'PLANNED' }),
  e(3, 'MUZI', 'MATCH', 18, '14:30', 'FK KNV — KŠK Rozhanovce', home, { opponent: 'KŠK Rozhanovce', isHome: true, state: 'PLANNED' }),
  e(4, 'U15 A', 'TRAINING', 14, '16:00', 'Technika a práca s loptou', 'Tréningová plocha · Agátová'),
  e(5, 'U15 A', 'TRAINING', 16, '16:30', 'Herná príprava', 'Tréningová plocha · Agátová'),
  e(6, 'U13 A', 'TRAINING', 15, '16:00', 'Koordinácia a prihrávky', 'Tréningová plocha · Agátová'),
  e(7, 'U19', 'MATCH', 17, '11:30', 'FK KNV — Stará Ľubovňa', home, { opponent: 'Stará Ľubovňa', isHome: true, state: 'PLANNED' }),
  e(8, 'U17', 'TRAINING', 15, '17:00', 'Herné situácie', 'Tréningová plocha · Agátová'),
  e(9, 'U11', 'TRAINING', 16, '15:00', 'Zábavný tréning s loptou', 'Tréningová plocha · Agátová'),
  e(10, 'U10', 'TRAINING', 14, '15:00', 'Pohybové hry', 'Tréningová plocha · Agátová'),
  e(11, 'U9', 'TRAINING', 15, '15:00', 'Prvé futbalové kroky', 'Tréningová plocha · Agátová'),
  e(12, 'U15 A', 'MATCH', 10, '10:00', 'FK KNV — Slovan Haniska', home, { opponent: 'Slovan Haniska', isHome: true, competition: 'Liga starších žiakov', scoreUs: 3, scoreThem: 1, state: 'FINISHED' }),
];

const ARTICLES: PublicArticle[] = [
  { id: 'demo-a1', slug: 'ukazkovy-clanok-start-sezony', title: 'Ukážkový článok: štart sezóny', excerpt: 'Takto bude vyzerať článok vytvorený v klubovom portáli.', body: ['Toto je ukážkový text. Skutočné články budú vytvárať a publikovať administrátori v portáli.', 'Druhý odsek ukážkového článku.'], publishedAt: '2026-10-12T09:00:00+02:00', tag: 'UKÁŽKA' },
  { id: 'demo-a2', slug: 'ukazkovy-clanok-nabor', title: 'Ukážkový článok: nábor do prípravky', excerpt: 'Druhá ukážková položka pre náhľad zoznamu noviniek.', body: ['Ukážkový text o nábore.'], publishedAt: '2026-10-05T09:00:00+02:00', tag: 'UKÁŽKA' },
];

export const demoDataSource: PublicDataSource = {
  isDemo: true,
  async getActiveSeason() { return { name: '2026/2027', isActive: true }; },
  async getTeams() { return TEAMS; },
  async getSquad(teamId) { const t = TEAMS.find((x) => x.id === teamId); return (t && SQUADS[t.name]) || []; },
  async getEvents(q: EventQuery = {}) {
    return EVENTS.filter((ev) =>
      (!q.categoryCode || ev.categoryCode === q.categoryCode) &&
      (!q.type || (q.type === 'match') === (ev.type === 'MATCH' || ev.type === 'TOURNAMENT')) &&
      (!q.from || ev.startAt >= q.from) && (!q.to || ev.startAt <= q.to),
    ).sort((a, b) => a.startAt.localeCompare(b.startAt));
  },
  async getEvent(id) { return EVENTS.find((x) => x.id === id) ?? null; },
  async listArticles() { return [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); },
  async getArticle(slug) { return ARTICLES.find((a) => a.slug === slug) ?? null; },
};
