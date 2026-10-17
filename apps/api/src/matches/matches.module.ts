import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchVideosService } from './match-videos.service';
import { MatchVideosController } from './match-videos.controller';
import { VeoService } from '../veo/veo.service';

@Module({
  providers: [MatchesService, MatchVideosService, VeoService],
  controllers: [MatchesController, MatchVideosController],
})
export class MatchesModule {}
