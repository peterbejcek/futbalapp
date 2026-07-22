import { Controller, Get } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { Public } from '../auth/public.decorator';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  /** Verejný endpoint — vygeneruje CAPTCHA obrázok a token. */
  @Public()
  @Get()
  create() {
    return this.captcha.generate();
  }
}
