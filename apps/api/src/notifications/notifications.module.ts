import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  providers: [PushService],
  controllers: [NotificationsController],
  exports: [PushService],
})
export class NotificationsModule {}
