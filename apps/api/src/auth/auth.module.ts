import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AccountsService } from './accounts.service';
import { AuthController } from './auth.controller';
import { CaptchaModule } from '../captcha/captcha.module';

@Global()
@Module({
  imports: [
    CaptchaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}` },
    }),
  ],
  providers: [AuthService, AccountsService],
  controllers: [AuthController],
  exports: [AuthService, AccountsService],
})
export class AuthModule {}
