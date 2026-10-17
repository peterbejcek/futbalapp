import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, unlink } from 'node:fs';
import { extname, join } from 'node:path';
import type { Readable } from 'node:stream';

/** Koreňový adresár pre nahrané súbory (Docker: named volume). */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || '/data/uploads';
}

/** Adresár s videami zo zápasov. */
export function videosDir(): string {
  return join(uploadsDir(), 'videos');
}

/** Max. veľkosť videa v MB (env MAX_VIDEO_MB, predvolene 500, strop 2000 kvôli Int v DB). */
export function maxVideoBytes(): number {
  const mb = Number(process.env.MAX_VIDEO_MB);
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 2000) : 500;
  return Math.floor(safe * 1024 * 1024);
}

/** Prípony videí z telefónov (iPhone .mov, Android .mp4/.3gp, webm z prehliadača). */
const VIDEO_EXT = ['.mp4', '.m4v', '.mov', '.webm', '.3gp', '.3g2', '.mkv'];

const EXT_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.3gp': 'video/3gpp',
  '.3g2': 'video/3gpp2',
  '.mkv': 'video/x-matroska',
};

/** MIME typ videa — niektoré telefóny posielajú prázdny/generický typ, vtedy podľa prípony. */
export function resolveVideoMime(mimetype: string | undefined, originalname: string | undefined): string | null {
  if (mimetype?.startsWith('video/')) return mimetype;
  const ext = extname(originalname ?? '').toLowerCase();
  return EXT_MIME[ext] ?? null;
}

interface MulterLikeFile {
  originalname: string;
  mimetype: string;
  stream: Readable;
}

/** Multer fileFilter — prepustí len videá. */
export function videoFileFilter(
  _req: unknown,
  file: { originalname: string; mimetype: string },
  cb: (error: Error | null, accept: boolean) => void,
) {
  if (resolveVideoMime(file.mimetype, file.originalname)) return cb(null, true);
  const ext = extname(file.originalname ?? '').toLowerCase();
  if (VIDEO_EXT.includes(ext)) return cb(null, true);
  cb(new BadRequestException('Nahrať možno len video (mp4, mov, webm)'), false);
}

/**
 * Multer storage engine — streamuje upload priamo na disk pod náhodným názvom
 * (nič sa nedrží v pamäti ani v Postgres). Pri prekročení limitu / chybe multer
 * zavolá _removeFile a čiastočný súbor sa zmaže.
 */
export const videoDiskStorage = {
  _handleFile(
    _req: unknown,
    file: MulterLikeFile,
    cb: (error: Error | null, info?: { path: string; filename: string; size: number }) => void,
  ) {
    const dir = videosDir();
    try {
      mkdirSync(dir, { recursive: true });
    } catch (e) {
      return cb(e as Error);
    }
    const filename = randomBytes(16).toString('hex');
    const path = join(dir, filename);
    const out = createWriteStream(path);
    let size = 0;
    let done = false;
    const finish = (err: Error | null) => {
      if (done) return;
      done = true;
      if (err) {
        unlink(path, () => cb(err));
        return;
      }
      cb(null, { path, filename, size });
    };
    file.stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    file.stream.on('error', (err: Error) => {
      out.destroy();
      finish(err);
    });
    out.on('error', (err) => finish(err));
    out.on('finish', () => finish(null));
    file.stream.pipe(out);
  },
  _removeFile(_req: unknown, file: { path?: string }, cb: (error: Error | null) => void) {
    if (!file.path) return cb(null);
    unlink(file.path, () => cb(null));
  },
};
