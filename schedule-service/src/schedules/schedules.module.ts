import { Module } from '@nestjs/common';
import { SchedulesResolver } from './schedules.resolver';
import { SchedulesService } from './schedules.service';
import { AppCacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AppCacheModule, NotificationsModule],
  providers: [
    SchedulesResolver,
    SchedulesService,
  ],
})
export class SchedulesModule {}