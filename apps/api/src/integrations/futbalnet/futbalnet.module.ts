import { Module } from '@nestjs/common';
import { FutbalnetService } from './futbalnet.service';
import { FutbalnetController } from './futbalnet.controller';
import { ClubsModule } from '../../clubs/clubs.module';

@Module({
  imports: [ClubsModule],
  providers: [FutbalnetService],
  controllers: [FutbalnetController],
})
export class FutbalnetModule {}
