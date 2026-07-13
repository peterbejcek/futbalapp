import { Module } from '@nestjs/common';
import { SeasonsModule } from '../seasons/seasons.module';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';

@Module({
  imports: [SeasonsModule],
  providers: [RegistrationService],
  controllers: [RegistrationController],
})
export class RegistrationModule {}
