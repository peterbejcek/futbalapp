import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  providers: [PushService, EmailService],
  controllers: [NotificationsController],
  exports: [PushService, EmailService],
})
export class NotificationsModule {}
