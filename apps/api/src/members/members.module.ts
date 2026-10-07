import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { IssfService } from '../integrations/issf/issf.service';

@Module({
  providers: [MembersService, IssfService],
  controllers: [MembersController],
  exports: [MembersService],
})
export class MembersModule {}
