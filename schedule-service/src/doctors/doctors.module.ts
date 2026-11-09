import { Module } from '@nestjs/common';
import { AppCacheModule } from '../cache/cache.module';
import { DoctorsResolver } from './doctors.resolver';
import { DoctorsService } from './doctors.service';

@Module({
  imports: [AppCacheModule],
  providers: [DoctorsResolver, DoctorsService],
})
export class DoctorsModule {}