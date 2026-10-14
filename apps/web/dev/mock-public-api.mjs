// DEV nástroj: mock verejného API (GET /api/v1/public/*) podľa packages/shared/src/public-api.ts.
// Všetky mená sú FIKTÍVNE. Nie je súčasťou aplikácie a NESMIE sa importovať zo src/.
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 3101);
const PREFIX = '/api/v1/public';

const club = { name: 'FK Košická Nová Ves', timezone: 'Europe/Bratislava' };
const season = { name: '2026/2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true };

const teams = [
  { id: 'team-u13a', name: 'U13 A', categoryCode: 'U13', categoryName: 'U13', sortOrder: 10, rosterSize: 5 },
  { id: 'team-u13b', name: 'U13 B', categoryCode: 'U13', categoryName: 'U13', sortOrder: 11, rosterSize: 2 },
  { id: 'team-u15a', name: 'U15 A', categoryCode: 'U15', categoryName: 'U15', sortOrder: 20, rosterSize: 4 },
];
const T = Object.fromEntries(teams.map((t) => [t.id, t]));

// Fiktívni hráči (FIKTÍVNE MENO). p3 má súhlas s fotkou, ale fotka neexistuje (photoUrl null).
const squads = {
  'team-u13a': [
    ['p1', 'Fiktívny', 'Hráč Jedna'], ['p2', 'Fiktívny', 'Hráč Dva'], ['p3', 'Fiktívny', 'Hráč Tri (bez fotky)'],
  ],
  'team-u13b': [['p4', 'Fiktívny', 'Hráč Štyri']],
  'team-u15a': [['p5', 'Fiktívny', 'Hráč Päť'], ['p6', 'Fiktívny', 'Hráč Šesť']],
};
// p1 má fotku (mock ju servuje ako 1x1 PNG), ostatní nie.
const withPhoto = new Set(['p1']);
const player = ([id, firstName, lastName]) => ({ id, firstName, lastName, photoUrl: withPhoto.has(id) ? `${PREFIX}/players/${id}/photo` : null });

const day = 86400000;
const at = (offsetDays, hour, min = 0) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
};
const end = (iso, mins) => new Date(Date.parse(iso) + mins * 60000).toISOString();

function match(id, teamId, offset, hour, opponent, isHome, extra = {}) {
  const t = T[teamId];
  const ours = `${club.name} ${t.name}`;
  const startAt = at(offset, hour);
  const m = {
    homeName: isHome ? ours : opponent, awayName: isHome ? opponent : ours, isHome, opponent,
    competition: 'Liga (FIKTÍVNA)', homeScore: null, awayScore: null,
  };
  Object.assign(m, extra.match ?? {});
  return {
    id, type: 'MATCH', state: extra.state ?? 'SCHEDULED', teamId, teamName: t.name, categoryCode: t.categoryCode, categoryName: t.categoryName,
    title: `${t.name} vs ${opponent}`, startAt, endAt: end(startAt, 90), location: isHome ? 'ihrisko KNV' : `ihrisko ${opponent}`, match: m,
  };
}
const training = (id, teamId, offset, hour) => {
  const t = T[teamId];
  const startAt = at(offset, hour);
  return { id, type: 'TRAINING', state: 'SCHEDULED', teamId, teamName: t.name, categoryCode: t.categoryCode, categoryName: t.categoryName,
    title: `Tréning ${t.name}`, startAt, endAt: end(startAt, 75), location: 'ihrisko KNV', match: null };
};

const events = [
  match('ev-1', 'team-u13a', -7, 9, 'FK Fiktívne Mesto', true, { state: 'FINISHED', match: { homeScore: 3, awayScore: 1 } }),
  match('ev-2', 'team-u15a', -2, 14, 'TJ Ukážka', false, { state: 'FINISHED', match: { homeScore: 0, awayScore: 2 } }),
  match('ev-3', 'team-u13a', 3, 9, 'ŠK Vzorka', false),
  match('ev-4', 'team-u13b', 5, 10, 'FK Príklad', true),
  match('ev-5', 'team-u15a', 9, 13, 'TJ Test', true, { state: 'CANCELLED' }),
  match('ev-6', 'team-u15a', 16, 13, 'FK Fiktívne Mesto', false),
  training('ev-7', 'team-u13a', 1, 16),
  training('ev-8', 'team-u15a', 2, 17),
];

const articles = [
  { id: 'a1', slug: 'ukazkovy-clanok-jedna', title: 'Ukážkový článok číslo jedna', excerpt: 'Krátky úryvok ukážkového článku (mock).', publishedAt: at(-3, 8),
    paragraphs: ['Prvý odsek ukážkového článku. Všetky údaje sú fiktívne.', 'Druhý odsek s <b>HTML</b>, ktoré sa musí zobraziť ako text.'] },
  { id: 'a2', slug: 'ukazkovy-clanok-dva', title: 'Ukážkový článok číslo dva', excerpt: 'Druhý ukážkový úryvok (mock).', publishedAt: at(-10, 8),
    paragraphs: ['Jediný odsek druhého ukážkového článku.'] },
];

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHDDIdQAAAABJRU5ErkJggg==', 'base64');

const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET') return json(res, 405, { message: 'Method Not Allowed' });

  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(PREFIX)) return json(res, 404, { message: 'Not Found' });
  const parts = url.pathname.slice(PREFIX.length).split('/').filter(Boolean);
  const q = url.searchParams;

  if (parts[0] === 'teams' && parts.length === 1) return json(res, 200, { club, season, teams });
  if (parts[0] === 'teams' && parts[2] === 'squad') {
    const team = T[parts[1]];
    if (!team) return json(res, 404, { message: 'Not Found' });
    return json(res, 200, { team, season, players: (squads[team.id] ?? []).map(player) });
  }
  if (parts[0] === 'players' && parts[2] === 'photo') {
    if (!withPhoto.has(parts[1])) return json(res, 404, { message: 'Not Found' });
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return res.end(PNG);
  }
  if (parts[0] === 'events' && parts.length === 1) {
    const type = q.get('type'), cat = q.get('categoryCode'), teamId = q.get('teamId'), from = q.get('from'), to = q.get('to');
    const limit = Number(q.get('limit')) || 200;
    const list = events
      .filter((e) => (type === 'match' ? e.type !== 'TRAINING' : type === 'training' ? e.type === 'TRAINING' : true))
      .filter((e) => !cat || e.categoryCode.toLowerCase() === cat.toLowerCase())
      .filter((e) => !teamId || e.teamId === teamId)
      .filter((e) => !from || e.startAt.slice(0, 10) >= from)
      .filter((e) => !to || e.startAt.slice(0, 10) <= to)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, limit);
    return json(res, 200, { club, season, events: list });
  }
  if (parts[0] === 'events' && parts.length === 2) {
    const e = events.find((x) => x.id === parts[1]);
    return e ? json(res, 200, { club, event: e }) : json(res, 404, { message: 'Not Found' });
  }
  if (parts[0] === 'articles' && parts.length === 1) {
    return json(res, 200, articles.map(({ paragraphs, ...item }) => item).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
  }
  if (parts[0] === 'articles' && parts.length === 2) {
    const a = articles.find((x) => x.slug === parts[1]);
    return a ? json(res, 200, a) : json(res, 404, { message: 'Not Found' });
  }
  return json(res, 404, { message: 'Not Found' });
});

server.listen(PORT, () => console.log(`Mock verejného API (FIKTÍVNE dáta): http://localhost:${PORT}${PREFIX}`));
