/**
 * Parser programu zápasov zo stránky sportnet.sme.sk (futbalnet).
 * Stránka je Next.js (SSR) — dáta zápasov sú vložené v HTML v RSC payloade,
 * kde sú úvodzovky escapované ako \". Vyberáme dvojice tímov, dátum a logá.
 */
export interface SportnetFixture {
  startAt: Date;
  home: string;
  homeLogo: string | null;
  away: string;
  awayLogo: string | null;
}

// date $D<iso>, homeTeam{name, ... logo.src}, ... awayTeam{name, ... logo.src}
const FIXTURE_RE =
  /date\\":\\"\$D([0-9T:.Z-]+)\\",\\"homeTeam\\":\{\\"name\\":\\"([^\\]+)\\"[\s\S]*?\\"logo\\":\{\\"src\\":\\"([^\\]+)\\"[\s\S]*?\\"awayTeam\\":\{\\"name\\":\\"([^\\]+)\\"[\s\S]*?\\"logo\\":\{\\"src\\":\\"([^\\]+)\\"/g;

export function parseSportnetProgram(html: string): SportnetFixture[] {
  const out: SportnetFixture[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  FIXTURE_RE.lastIndex = 0;
  while ((m = FIXTURE_RE.exec(html))) {
    const [, iso, home, homeLogo, away, awayLogo] = m;
    if (!iso || !home || !away) continue;
    const startAt = new Date(iso);
    if (Number.isNaN(startAt.getTime())) continue;
    const key = `${iso}|${home}|${away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      startAt,
      home: home.trim(),
      homeLogo: homeLogo || null,
      away: away.trim(),
      awayLogo: awayLogo || null,
    });
  }
  return out;
}

/** Stabilný externý identifikátor zápasu pre idempotentný import. */
export function sportnetMatchKey(f: SportnetFixture): string {
  return `sn:${f.startAt.toISOString()}:${f.home}=>${f.away}`;
}
