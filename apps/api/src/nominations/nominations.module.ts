import { Module } from '@nestjs/common';
import { NominationRequestsService } from './nomination-requests.service';
import { NominationRequestsController } from './nomination-requests.controller';

@Module({
  providers: [NominationRequestsService],
  controllers: [NominationRequestsController],
})
export class NominationsModule {}
