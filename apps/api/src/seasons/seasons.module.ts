import { Module } from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { SeasonsController } from './seasons.controller';

@Module({
  providers: [SeasonsService],
  controllers: [SeasonsController],
  exports: [SeasonsService],
})
export class SeasonsModule {}
