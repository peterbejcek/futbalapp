import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { MembersModule } from './members/members.module';
import { SeasonsModule } from './seasons/seasons.module';
import { RegistrationModule } from './registration/registration.module';
import { EventsModule } from './events/events.module';
import { MatchesModule } from './matches/matches.module';
import { FinanceModule } from './finance/finance.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { FutbalnetModule } from './integrations/futbalnet/futbalnet.module';
import { CaptchaModule } from './captcha/captcha.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    AuthModule,
    MembersModule,
    SeasonsModule,
    RegistrationModule,
    EventsModule,
    MatchesModule,
    FinanceModule,
    ChatModule,
    ReportsModule,
    FutbalnetModule,
    CaptchaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
