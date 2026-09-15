/**
 * Parser programu zápasov zo stránky sportnet.sme.sk (futbalnet).
 * Stránka je Next.js (SSR) — dáta zápasov sú vložené v HTML v RSC payloade,
 * kde sú úvodzovky escapované ako \". Vyberáme stabilné ID zápasu, dvojice
 * tímov, dátum a logá.
 */
export interface SportnetFixture {
  /** Stabilné ID zápasu zo sportnetu (nemení sa pri preložení termínu). */
  id: string;
  startAt: Date;
  home: string;
  homeLogo: string | null;
  away: string;
  awayLogo: string | null;
}

// {id, appSpace, ... date $D<iso>, homeTeam{name, ... logo.src}, ... awayTeam{name, ... logo.src}}
// id je zachytené na začiatku objektu zápasu (za ním nasleduje appSpace), aby sa
// spoľahlivo viazalo na správny zápas.
const FIXTURE_RE =
  /\\"id\\":\\"([a-f0-9]{24})\\",\\"appSpace\\"[\s\S]*?date\\":\\"\$D([0-9T:.Z-]+)\\",\\"homeTeam\\":\{\\"name\\":\\"([^\\]+)\\"[\s\S]*?\\"logo\\":\{\\"src\\":\\"([^\\]+)\\"[\s\S]*?\\"awayTeam\\":\{\\"name\\":\\"([^\\]+)\\"[\s\S]*?\\"logo\\":\{\\"src\\":\\"([^\\]+)\\"/g;

export function parseSportnetProgram(html: string): SportnetFixture[] {
  const out: SportnetFixture[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  FIXTURE_RE.lastIndex = 0;
  while ((m = FIXTURE_RE.exec(html))) {
    const [, id, iso, home, homeLogo, away, awayLogo] = m;
    if (!id || !iso || !home || !away) continue;
    const startAt = new Date(iso);
    if (Number.isNaN(startAt.getTime())) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      startAt,
      home: home.trim(),
      homeLogo: homeLogo || null,
      away: away.trim(),
      awayLogo: awayLogo || null,
    });
  }
  return out;
}

/** Stabilný externý identifikátor zápasu pre idempotentný import (prežije zmenu termínu). */
export function sportnetMatchKey(f: SportnetFixture): string {
  return `sn:${f.id}`;
}
