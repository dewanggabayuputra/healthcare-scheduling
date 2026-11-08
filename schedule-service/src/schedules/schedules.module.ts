import { Module } from '@nestjs/common';
import { SchedulesResolver } from './schedules.resolver';
import { SchedulesService } from './schedules.service';

@Module({
  providers: [
    SchedulesResolver,
    SchedulesService,
  ],
})
export class SchedulesModule {}