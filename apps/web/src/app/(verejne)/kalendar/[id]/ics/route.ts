import { getPublicData } from '@/lib/verejne/data-source';
import { isMatchType } from '@/lib/verejne/format';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Zalamovanie riadkov na 75 oktetov (RFC 5545), pokračovanie začína medzerou. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
    cur += ch;
    len += l;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getPublicData().getEvent(id);
  if (!e) return new Response('Udalosť neexistuje', { status: 404 });

  const start = new Date(e.startAt);
  const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 90 * 60000);
  const summary = isMatchType(e.type) && e.match ? `${e.teamName}: FK KNV — ${e.match.opponent}` : `${e.teamName}: ${e.title}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FK KNV//Verejny web//SK',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id.replace(/[^A-Za-z0-9._-]/g, '')}@fkknv.sk`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${esc(summary)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const body = lines.map(fold).join('\r\n') + '\r\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="fkknv-${e.id.replace(/[^A-Za-z0-9._-]/g, '')}.ics"`,
    },
  });
}
