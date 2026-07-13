import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ExcelService } from './excel.service';
import { ReportsController } from './reports.controller';

@Module({
  providers: [ReportsService, ExcelService],
  controllers: [ReportsController],
})
export class ReportsModule {}
