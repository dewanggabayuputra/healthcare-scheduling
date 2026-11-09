import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Processor('notifications')
export class EmailProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailProcessor.name);

    constructor(private readonly emailService: EmailService) {
        super();
    }

    async process(job: Job): Promise<any> {
        switch (job.name) {
            case 'send-schedule-created-email':
                return this.emailService.sendScheduleCreatedEmail(job.data);

            case 'send-schedule-deleted-email':
                return this.emailService.sendScheduleDeletedEmail(job.data);

            default:
                throw new Error(`Unknown job: ${job.name}`);
        }
    }
}