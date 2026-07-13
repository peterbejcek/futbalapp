import { Module } from '@nestjs/common';
import { FutbalnetService } from './futbalnet.service';
import { FutbalnetController } from './futbalnet.controller';

@Module({
  providers: [FutbalnetService],
  controllers: [FutbalnetController],
})
export class FutbalnetModule {}
