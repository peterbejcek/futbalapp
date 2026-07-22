import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { registrationRequestSchema, type RegistrationRequestInput } from '@fkknv/shared';
import { RegistrationService } from './registration.service';
import { CaptchaService } from '../captcha/captcha.service';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('registration')
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly captcha: CaptchaService,
  ) {}

  /** Verejný registračný formulár na fkknv.sk (chránený CAPTCHA) */
  @Public()
  @Post()
  submit(
    @Body(new ZodValidationPipe(registrationRequestSchema)) body: RegistrationRequestInput,
    @Body('captcha') captcha?: { token?: string; answer?: string },
  ) {
    this.captcha.assertValid(captcha?.token, captcha?.answer);
    return this.registrationService.submit(body);
  }

  @Get('pending')
  @Roles('ADMIN', 'MANAGER')
  listPending() {
    return this.registrationService.listPending();
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registrationService.approve(id, user.id);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'MANAGER')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registrationService.reject(id, user.id);
  }
}
