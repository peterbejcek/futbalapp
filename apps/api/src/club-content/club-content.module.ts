import { Module } from '@nestjs/common';
import { ClubContentController } from './club-content.controller';
import { ClubContentService } from './club-content.service';

@Module({
  controllers: [ClubContentController],
  providers: [ClubContentService],
})
export class ClubContentModule {}
