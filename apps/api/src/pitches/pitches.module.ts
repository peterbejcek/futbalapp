import { Module } from '@nestjs/common';
import { PitchesService } from './pitches.service';
import { PitchesController } from './pitches.controller';

@Module({
  providers: [PitchesService],
  controllers: [PitchesController],
})
export class PitchesModule {}
