import { Module } from '@nestjs/common';
import { DoctorsResolver } from './doctors.resolver';
import { DoctorsService } from './doctors.service';

@Module({
  providers: [DoctorsResolver, DoctorsService],
})
export class DoctorsModule {}