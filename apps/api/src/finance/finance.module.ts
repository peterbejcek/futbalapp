import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { DunningService } from './dunning.service';
import { FinanceController } from './finance.controller';

@Module({
  providers: [FinanceService, DunningService],
  controllers: [FinanceController],
})
export class FinanceModule {}
