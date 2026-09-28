import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { VeoService } from '../veo/veo.service';

@Module({
  providers: [MatchesService, VeoService],
  controllers: [MatchesController],
})
export class MatchesModule {}
