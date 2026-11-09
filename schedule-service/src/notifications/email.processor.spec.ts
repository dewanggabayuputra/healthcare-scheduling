import { Job } from 'bullmq';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  WorkerHost: class {},
}));

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let emailService: {
    sendScheduleCreatedEmail: jest.Mock;
    sendScheduleDeletedEmail: jest.Mock;
  };

  beforeEach(() => {
    emailService = {
      sendScheduleCreatedEmail: jest.fn().mockResolvedValue('created'),
      sendScheduleDeletedEmail: jest.fn().mockResolvedValue('deleted'),
    };
    processor = new EmailProcessor(emailService as unknown as EmailService);
  });

  it('processes a schedule-created email job', async () => {
    const job = {
      name: 'send-schedule-created-email',
      data: { customerEmail: 'patient@example.com' },
    } as Job;

    await expect(processor.process(job)).resolves.toBe('created');
    expect(emailService.sendScheduleCreatedEmail).toHaveBeenCalledWith(
      job.data,
    );
  });

  it('processes a schedule-deleted email job', async () => {
    const job = {
      name: 'send-schedule-deleted-email',
      data: { customerEmail: 'patient@example.com' },
    } as Job;

    await expect(processor.process(job)).resolves.toBe('deleted');
    expect(emailService.sendScheduleDeletedEmail).toHaveBeenCalledWith(
      job.data,
    );
  });

  it('rejects unknown notification jobs', async () => {
    const job = { name: 'unknown-job', data: {} } as Job;

    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job: unknown-job',
    );
  });
});
