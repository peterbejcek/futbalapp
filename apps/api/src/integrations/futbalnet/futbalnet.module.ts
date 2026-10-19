import { Module } from '@nestjs/common';
import { FutbalnetService } from './futbalnet.service';
import { FutbalnetController } from './futbalnet.controller';
import { MatchSyncService } from './match-sync.service';
import { MatchSyncController } from './match-sync.controller';
import { ClubsModule } from '../../clubs/clubs.module';

@Module({
  imports: [ClubsModule],
  providers: [FutbalnetService, MatchSyncService],
  controllers: [FutbalnetController, MatchSyncController],
})
export class FutbalnetModule {}
