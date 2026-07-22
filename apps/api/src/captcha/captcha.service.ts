import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import svgCaptcha from 'svg-captcha';

const SECRET = process.env.CAPTCHA_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
const TTL_MS = 10 * 60 * 1000; // platnosť 10 minút

/**
 * Jednoduchá self-hosted CAPTCHA (bez tretej strany, bez externých volaní).
 * Znaky sú vykreslené ako SVG cesty (nie čitateľný text), riešenie je uložené
 * len ako HMAC podpis v tokene (stateless). Použité tokeny sa spália, aby sa
 * to isté riešenie nedalo poslať viackrát.
 */
@Injectable()
export class CaptchaService {
  private readonly usedTokens = new Map<string, number>(); // token → expiry (proti replay)

  /** Vygeneruje obrázok + podpísaný token. */
  generate(): { token: string; svg: string } {
    const captcha = svgCaptcha.create({
      size: 5,
      noise: 3,
      color: true,
      ignoreChars: '0oO1ilI', // podobné znaky preč
      background: '#f1f5f9',
    });
    return { token: this.sign(captcha.text), svg: captcha.data };
  }

  /** Overí odpoveď; vyhodí BadRequest, ak je nesprávna/expirovaná/použitá. */
  assertValid(token: string | undefined, answer: string | undefined) {
    if (!token || !answer || !this.verify(token, answer)) {
      throw new BadRequestException('Overenie, že ste človek, zlyhalo. Skúste to znova.');
    }
  }

  private sign(text: string): string {
    const expiry = Date.now() + TTL_MS;
    const payload = `${expiry}:${text.toLowerCase()}`;
    const mac = createHmac('sha256', SECRET).update(payload).digest('hex');
    return `${expiry}.${mac}`;
  }

  private verify(token: string, answer: string): boolean {
    const [expiryStr, mac] = token.split('.');
    const expiry = Number(expiryStr);
    if (!expiryStr || !mac || !Number.isFinite(expiry) || expiry < Date.now()) return false;

    const expected = createHmac('sha256', SECRET).update(`${expiry}:${answer.trim().toLowerCase()}`).digest('hex');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    // proti opakovanému použitiu už vyriešenej CAPTCHA
    this.cleanup();
    if (this.usedTokens.has(token)) return false;
    this.usedTokens.set(token, expiry);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [token, expiry] of this.usedTokens) if (expiry < now) this.usedTokens.delete(token);
  }
}
