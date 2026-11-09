import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScheduleEmailData } from './interfaces/schedule.email.data';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectQueue('notifications')
        private readonly notificationQueue: Queue,
    ) {}

    async sendScheduleCreatedEmail(data: ScheduleEmailData) {
        return this.notificationQueue.add(
            'send-schedule-created-email',
            data,
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        );
    }

    async sendScheduleDeletedEmail(data: ScheduleEmailData) {
        return this.notificationQueue.add(
            'send-schedule-deleted-email',
            data,
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        );
    }
  
}