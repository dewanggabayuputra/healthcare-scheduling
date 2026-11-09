import { Queue } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { ScheduleEmailData } from './interfaces/schedule.email.data';

jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queue: { add: jest.Mock };
  const data: ScheduleEmailData = {
    customerEmail: 'patient@example.com',
    customerName: 'Patient',
    doctorName: 'Dr. Doe',
    objective: 'Consultation',
    scheduledAt: new Date('2030-01-15T09:00:00.000Z'),
  };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-id' }) };
    service = new NotificationsService(queue as unknown as Queue);
  });

  it('queues a confirmation email with retry settings', async () => {
    await expect(service.sendScheduleCreatedEmail(data)).resolves.toEqual({
      id: 'job-id',
    });
    expect(queue.add).toHaveBeenCalledWith(
      'send-schedule-created-email',
      data,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  });

  it('queues a cancellation email with retry settings', async () => {
    await service.sendScheduleDeletedEmail(data);

    expect(queue.add).toHaveBeenCalledWith(
      'send-schedule-deleted-email',
      data,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  });
});
