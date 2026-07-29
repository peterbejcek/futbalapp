import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { loginSchema, type LoginInput } from '@fkknv/shared';
import { AuthService } from './auth.service';
import { AccountsService } from './accounts.service';
import { CaptchaService } from '../captcha/captcha.service';
import { Public } from './public.decorator';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
    private readonly captcha: CaptchaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Body('captcha') captcha?: { token?: string; answer?: string },
  ) {
    this.captcha.assertValid(captcha?.token, captcha?.answer);
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    return this.accountsService.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
