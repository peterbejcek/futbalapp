import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { loginSchema, type LoginInput } from '@fkknv/shared';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }
}
