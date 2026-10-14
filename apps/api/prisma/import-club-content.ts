/**
 * Jednorazový importér klubového obsahu zo starého webu (manifest
 * prisma/content-import/club-content.json) do ClubPage, ClubPerson,
 * ClubDocument a Article.
 *
 * NESPÚŠŤA sa automaticky (nie je súčasťou seedu ani štartu API).
 *
 *   pnpm content:import                    # DRY-RUN: iba vypíše plán (číta DB, nič nezapisuje)
 *   pnpm content:import -- --verify-files  # DRY-RUN + stiahne súbory a overí SHA-256
 *   pnpm content:import -- --apply         # skutočný zápis
 *
 * Pravidlá:
 *  - bez DATABASE_URL skončí chybou,
 *  - idempotentné: kľúč je slug (stránky, články), sourceUrl+name (osoby), sourceUrl+title (dokumenty),
 *  - záznam s confirmedAt alebo upravený správcom (updatedAt > createdAt) sa NEPREPISUJE, iba sa preskočí,
 *  - záznamy sa vytvoria presne so stavom z manifestu, confirmedAt sa nikdy nenastavuje,
 *  - dokumenty: súbor sa stiahne zo sourceUrl (iba z hostu zdroja), over sa SHA-256 s manifestom;
 *    pri zhode sa bajty uložia nezmenené, pri nezhode/nedostupnosti sa uloží záznam bez súboru (iba sourceUrl).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type DocCategory = 'CONTRACT' | 'SUBSIDY' | 'TAX_FORM' | 'ANNOUNCEMENT' | 'OTHER';
type PersonGroup = 'MANAGEMENT' | 'COACH' | 'OTHER';

interface Manifest {
  retrievedAt: string;
  source: string;
  pages: Array<{ slug: string; title: string; body: string; status: Status; sourceUrl: string | null; sourceNote: string | null }>;
  people: Array<{
    name: string;
    role: string;
    group: PersonGroup;
    teamNote: string | null;
    phone: string | null;
    email: string | null;
    status: Status;
    sourceUrl: string | null;
    sourceNote: string | null;
  }>;
  documents: Array<{
    title: string;
    description: string | null;
    category: DocCategory;
    documentDate: string | null;
    originalFilename: string | null;
    mimeType: string | null;
    size: number | null;
    sha256: string | null;
    sourceUrl: string | null;
    sourceNote: string | null;
    status: Status;
  }>;
  articles: Array<{
    slug: string;
    title: string;
    excerpt: string;
    body: string;
    publishedAt: string | null;
    isArchive: boolean;
    sourceUrl: string | null;
  }>;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY_FILES = APPLY || args.includes('--verify-files');

const counters = { create: 0, update: 0, skip: 0, warn: 0 };
const log = (action: string, kind: string, label: string, extra = '') => {
  const tag = APPLY ? action : `(dry-run) ${action}`;
  console.log(`  ${tag.padEnd(22)} ${kind.padEnd(9)} ${label}${extra ? '  — ' + extra : ''}`);
};

function targetHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname.replace(/^\//, '') ? '/' + u.pathname.replace(/^\//, '') : ''}`;
  } catch {
    return '(neplatná DATABASE_URL)';
  }
}

/** Záznam mení správca, ak je potvrdený alebo upravený po vytvorení (tolerancia 2 s). */
const isProtected = (r: { confirmedAt?: Date | null; createdAt: Date; updatedAt: Date }) =>
  !!r.confirmedAt || r.updatedAt.getTime() - r.createdAt.getTime() > 2000;

async function downloadVerified(
  manifest: Manifest,
  d: Manifest['documents'][number],
): Promise<{ data: Buffer; size: number } | null> {
  if (!d.sourceUrl || !d.sha256) return null;
  let url: URL;
  try {
    url = new URL(d.sourceUrl);
  } catch {
    console.warn(`  VAROVANIE: neplatná sourceUrl dokumentu „${d.title}“`);
    return null;
  }
  if (url.protocol !== 'https:' || url.host !== new URL(manifest.source).host) {
    console.warn(`  VAROVANIE: sourceUrl dokumentu „${d.title}“ nie je na hoste zdroja – nestiahnuté`);
    return null;
  }
  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
    if (!res.ok) {
      console.warn(`  VAROVANIE: „${d.title}“ – HTTP ${res.status}, uložím iba odkaz`);
      return null;
    }
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_FILE_BYTES) {
      console.warn(`  VAROVANIE: „${d.title}“ – súbor je príliš veľký (${len} B), uložím iba odkaz`);
      return null;
    }
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_FILE_BYTES) {
      console.warn(`  VAROVANIE: „${d.title}“ – súbor je príliš veľký (${data.length} B), uložím iba odkaz`);
      return null;
    }
    const sha = createHash('sha256').update(data).digest('hex');
    if (sha !== d.sha256) {
      console.warn(`  VAROVANIE: „${d.title}“ – SHA-256 sa nezhoduje s manifestom (zdroj sa zmenil), uložím iba odkaz`);
      return null;
    }
    if (d.size != null && data.length !== d.size) {
      console.warn(`  VAROVANIE: „${d.title}“ – veľkosť sa nezhoduje s manifestom, uložím iba odkaz`);
      return null;
    }
    return { data, size: data.length };
  } catch (e) {
    console.warn(`  VAROVANIE: „${d.title}“ – sťahovanie zlyhalo (${(e as Error).message}), uložím iba odkaz`);
    return null;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('CHYBA: DATABASE_URL nie je nastavená – import sa nespustí. Nastav ju explicitne pre cieľovú databázu.');
    process.exit(1);
  }
  const manifest: Manifest = JSON.parse(readFileSync(join(__dirname, 'content-import', 'club-content.json'), 'utf8'));

  console.log(`Import klubového obsahu — režim: ${APPLY ? 'APPLY (ZÁPIS)' : 'DRY-RUN (nič sa nezapisuje)'}`);
  console.log(`Cieľová databáza (host): ${targetHost(dbUrl)}`);
  console.log(`Zdroj: ${manifest.source}, prevzaté ${manifest.retrievedAt}`);
  console.log(
    `Manifest: ${manifest.pages.length} stránok, ${manifest.people.length} osôb, ${manifest.documents.length} dokumentov, ${manifest.articles.length} článkov`,
  );
  if (!APPLY && !VERIFY_FILES) console.log('(súbory sa v dry-run nesťahujú; použi --verify-files na overenie SHA-256)');
  console.log('');

  const prisma = new PrismaClient();
  try {
    console.log('Stránky:');
    for (const [i, p] of manifest.pages.entries()) {
      const ex = await prisma.clubPage.findUnique({ where: { slug: p.slug } });
      const data = { title: p.title, body: p.body, status: p.status, sourceUrl: p.sourceUrl, sourceNote: p.sourceNote, sortOrder: i };
      if (ex && isProtected(ex)) {
        counters.skip++;
        log('PRESKOČENÉ', 'stránka', p.slug, 'potvrdená alebo upravená správcom');
      } else if (ex) {
        counters.update++;
        log('AKTUALIZOVAŤ', 'stránka', p.slug, p.status);
        if (APPLY) await prisma.clubPage.update({ where: { id: ex.id }, data });
      } else {
        counters.create++;
        log('VYTVORIŤ', 'stránka', p.slug, p.status);
        if (APPLY) await prisma.clubPage.create({ data: { slug: p.slug, ...data } });
      }
    }

    console.log('Osoby:');
    for (const [i, p] of manifest.people.entries()) {
      const ex = await prisma.clubPerson.findFirst({ where: { sourceUrl: p.sourceUrl, name: p.name } });
      const data = {
        role: p.role,
        group: p.group,
        teamNote: p.teamNote,
        phone: p.phone,
        email: p.email,
        status: p.status,
        sourceNote: p.sourceNote,
        sortOrder: i,
      };
      if (ex && isProtected(ex)) {
        counters.skip++;
        log('PRESKOČENÉ', 'osoba', p.name, 'potvrdená alebo upravená správcom');
      } else if (ex) {
        counters.update++;
        log('AKTUALIZOVAŤ', 'osoba', p.name, p.status);
        if (APPLY) await prisma.clubPerson.update({ where: { id: ex.id }, data });
      } else {
        counters.create++;
        log('VYTVORIŤ', 'osoba', p.name, p.status);
        if (APPLY) await prisma.clubPerson.create({ data: { name: p.name, sourceUrl: p.sourceUrl, ...data } });
      }
    }

    console.log('Dokumenty:');
    for (const [i, d] of manifest.documents.entries()) {
      const ex = await prisma.clubDocument.findFirst({ where: { sourceUrl: d.sourceUrl, title: d.title } });
      if (ex && isProtected(ex)) {
        counters.skip++;
        log('PRESKOČENÉ', 'dokument', d.title, 'potvrdený alebo upravený správcom');
        continue;
      }
      let file: { data: Buffer; size: number } | null = null;
      if (VERIFY_FILES) {
        file = await downloadVerified(manifest, d);
        if (!file) counters.warn++;
      }
      const base = {
        description: d.description,
        category: d.category,
        documentDate: d.documentDate ? new Date(`${d.documentDate}T00:00:00.000Z`) : null,
        sourceNote: d.sourceNote,
        status: d.status,
        sortOrder: i,
      };
      const fileFields = file
        ? { data: file.data, size: file.size, mimeType: d.mimeType, originalFilename: d.originalFilename, sha256: d.sha256 }
        : { data: null, size: null, mimeType: null, originalFilename: null, sha256: null };
      const note = VERIFY_FILES ? (file ? 'súbor overený (SHA-256 zhoda)' : 'iba odkaz (bez súboru)') : 'súbor sa overí pri --apply';
      if (ex) {
        counters.update++;
        log('AKTUALIZOVAŤ', 'dokument', d.title, `${d.status}; ${note}`);
        if (APPLY) {
          await prisma.clubDocument.update({
            where: { id: ex.id },
            // už uložený (overený) súbor sa pri neúspešnom stiahnutí nemaže
            data: { ...base, ...(file ? fileFields : {}) } as Prisma.ClubDocumentUpdateInput,
          });
        }
      } else {
        counters.create++;
        log('VYTVORIŤ', 'dokument', d.title, `${d.status}; ${note}`);
        if (APPLY) {
          await prisma.clubDocument.create({
            data: { title: d.title, sourceUrl: d.sourceUrl, ...base, ...fileFields } as Prisma.ClubDocumentUncheckedCreateInput,
          });
        }
      }
    }

    console.log('Články (archív):');
    for (const a of manifest.articles) {
      const ex = await prisma.article.findUnique({ where: { slug: a.slug } });
      if (ex) {
        // články nemajú confirmedAt – existujúci článok sa nikdy neprepisuje
        counters.skip++;
        log('PRESKOČENÉ', 'článok', a.slug, 'už existuje');
      } else {
        counters.create++;
        log('VYTVORIŤ', 'článok', a.slug, a.publishedAt?.slice(0, 10) ?? '');
        if (APPLY) {
          await prisma.article.create({
            data: {
              slug: a.slug,
              title: a.title,
              excerpt: a.excerpt,
              body: a.body,
              publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
              isArchive: a.isArchive,
              sourceUrl: a.sourceUrl,
            },
          });
        }
      }
    }

    console.log('');
    console.log(
      `${APPLY ? 'Hotovo' : 'DRY-RUN hotový'}: vytvoriť ${counters.create}, aktualizovať ${counters.update}, preskočiť ${counters.skip}, varovania ${counters.warn}.`,
    );
    if (!APPLY) console.log('Nič sa nezapísalo. Na zápis spusti s --apply.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Import zlyhal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
