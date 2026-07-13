import { Injectable, Logger } from '@nestjs/common';

/**
 * Odosielanie e-mailov cez Resend (https://resend.com).
 * Bez RESEND_API_KEY (dev/test) sa e-mail iba zaloguje — aplikácia
 * funguje rovnako, len sa nič neodošle.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from = process.env.EMAIL_FROM ?? 'FK Košická Nová Ves <noreply@fkknv.sk>';

  async send(to: string[], subject: string, html: string): Promise<{ sent: boolean }> {
    if (to.length === 0) return { sent: false };
    if (!this.apiKey) {
      this.logger.log(`[DEV e-mail] to=${to.join(',')} subject="${subject}"`);
      return { sent: false };
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });
      if (!response.ok) {
        this.logger.warn(`Resend vrátil ${response.status}: ${await response.text()}`);
        return { sent: false };
      }
      return { sent: true };
    } catch (error) {
      this.logger.warn(`E-mail zlyhal: ${error instanceof Error ? error.message : error}`);
      return { sent: false };
    }
  }
}
