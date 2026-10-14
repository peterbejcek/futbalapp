import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

/** Privátna/loopback adresa (docker sieť, localhost). */
export function isPrivateAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (/^(10\.|127\.|192\.168\.)/.test(v4)) return true;
  const m = /^172\.(\d+)\./.exec(v4);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return ip === '::1' || /^f[cd][0-9a-f]{2}:/i.test(ip);
}

/**
 * Server-side volania verejného webu (Next.js → http://api:3001) idú priamo
 * z docker siete bez X-Forwarded-For — tie rate-limit nepočíta, inak by všetci
 * návštevníci webu zdieľali jeden limit. Požiadavky zvonka idú vždy cez Caddy,
 * ktorý X-Forwarded-For nastaví (API nemá publikovaný port).
 */
export function isInternalRequest(req: Pick<Request, 'headers' | 'socket'>): boolean {
  return !req.headers['x-forwarded-for'] && isPrivateAddress(req.socket?.remoteAddress);
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'public', ttl: 60_000, limit: 120 }],
      skipIf: (ctx) => isInternalRequest(ctx.switchToHttp().getRequest<Request>()),
    }),
  ],
  controllers: [PublicController],
  providers: [PublicService, ThrottlerGuard],
})
export class PublicModule {}
