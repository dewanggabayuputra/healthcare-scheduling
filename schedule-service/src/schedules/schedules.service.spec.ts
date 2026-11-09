import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulesService } from './schedules.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../cache/cache.service', () => ({
  CacheService: class CacheService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

describe('SchedulesService', () => {
  let service: SchedulesService;
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    getNamespaceVersion: jest.Mock;
    invalidateNamespace: jest.Mock;
  };
  let notifications: {
    sendScheduleCreatedEmail: jest.Mock;
    sendScheduleDeletedEmail: jest.Mock;
  };
  let prisma: {
    customer: { findUnique: jest.Mock };
    doctor: { findUnique: jest.Mock };
    schedule: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const futureDate = () => new Date(Date.now() + 60_000);
  const input = () => ({
    objective: '  Consultation ',
    customerId: 'customer-id',
    doctorId: 'doctor-id',
    scheduledAt: futureDate(),
  });

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      del: jest.fn(),
      getNamespaceVersion: jest.fn().mockResolvedValue('version'),
      invalidateNamespace: jest.fn(),
    };
    notifications = {
      sendScheduleCreatedEmail: jest.fn().mockResolvedValue(undefined),
      sendScheduleDeletedEmail: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      customer: { findUnique: jest.fn() },
      doctor: { findUnique: jest.fn() },
      schedule: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(SchedulesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a schedule in the past', async () => {
    await expect(
      service.create({ ...input(), scheduledAt: new Date(Date.now() - 1) }),
    ).rejects.toThrow('Schedule must be in the future');
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('requires an existing customer and doctor before creating', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.create(input())).rejects.toThrow('Customer not found');
    expect(prisma.doctor.findUnique).not.toHaveBeenCalled();
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });

  it('rejects a time already occupied by the doctor', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-id' });
    prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-id' });
    prisma.schedule.findUnique.mockResolvedValue({ id: 'existing-id' });

    await expect(service.create(input())).rejects.toThrow(
      'Doctor already has a schedule at this time',
    );
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });

  it('creates a future schedule after validating its references', async () => {
    const scheduleInput = input();
    const created = { id: 'schedule-id', ...scheduleInput };
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-id' });
    prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-id' });
    prisma.schedule.findUnique.mockResolvedValue(null);
    prisma.schedule.create.mockResolvedValue(created);

    await expect(service.create(scheduleInput)).resolves.toBe(created);
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('schedules');
    expect(notifications.sendScheduleCreatedEmail).toHaveBeenCalledWith({
      customerEmail: undefined,
      customerName: undefined,
      doctorName: undefined,
      objective: created.objective,
      scheduledAt: scheduleInput.scheduledAt,
    });
    expect(prisma.schedule.create).toHaveBeenCalledWith({
      data: {
        objective: 'Consultation',
        customerId: 'customer-id',
        doctorId: 'doctor-id',
        scheduledAt: scheduleInput.scheduledAt,
      },
    });
  });

  it('rejects a filter whose start date is after its end date', async () => {
    await expect(
      service.findAll(1, 10, {
        fromDate: new Date('2026-12-02T00:00:00.000Z'),
        toDate: new Date('2026-12-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('fromDate must be earlier than or equal to toDate');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies filters and pagination when listing schedules', async () => {
    const fromDate = new Date('2026-12-01T00:00:00.000Z');
    const toDate = new Date('2026-12-31T23:59:59.999Z');
    const items = [{ id: 'schedule-id' }];
    prisma.$transaction.mockResolvedValue([items, 1]);

    await expect(
      service.findAll(2, 5, {
        doctorId: 'doctor-id',
        fromDate,
        toDate,
      }),
    ).resolves.toEqual({
      items,
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });

    expect(prisma.schedule.findMany).toHaveBeenCalledWith({
      where: {
        doctorId: 'doctor-id',
        scheduledAt: { gte: fromDate, lte: toDate },
      },
      skip: 5,
      take: 5,
      orderBy: { scheduledAt: 'asc' },
    });
    expect(prisma.schedule.count).toHaveBeenCalledWith({
      where: {
        doctorId: 'doctor-id',
        scheduledAt: { gte: fromDate, lte: toDate },
      },
    });
  });

  it('returns a cached schedule list with restored dates', async () => {
    cache.get.mockResolvedValue({
      items: [
        {
          id: 'schedule-id',
          objective: 'Consultation',
          customerId: 'customer-id',
          doctorId: 'doctor-id',
          scheduledAt: '2026-11-08T21:35:16.730Z',
          createdAt: '2026-11-08T21:35:16.730Z',
          updatedAt: '2026-11-08T21:35:16.730Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await service.findAll();

    expect(result.items[0].scheduledAt).toBeInstanceOf(Date);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when the requested schedule does not exist', async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(
      'Schedule not found',
    );
  });

  it('caches a schedule returned from Prisma', async () => {
    const schedule = {
      id: 'schedule-id',
      scheduledAt: futureDate(),
    };
    prisma.schedule.findUnique.mockResolvedValue(schedule);

    await expect(service.findOne('schedule-id')).resolves.toBe(schedule);
    expect(cache.set).toHaveBeenCalledWith(
      'schedules:detail:schedule-id',
      schedule,
      60_000,
    );
  });

  it('restores cached schedule dates to Date instances', async () => {
    cache.get.mockResolvedValue({
      id: 'schedule-id',
      objective: 'Consultation',
      customerId: 'customer-id',
      doctorId: 'doctor-id',
      scheduledAt: '2026-11-08T21:35:16.730Z',
      createdAt: '2026-11-08T21:35:16.730Z',
      updatedAt: '2026-11-08T21:35:16.730Z',
    });

    const schedule = await service.findOne('schedule-id');

    expect(schedule.scheduledAt).toBeInstanceOf(Date);
    expect(schedule.createdAt).toBeInstanceOf(Date);
    expect(schedule.updatedAt).toBeInstanceOf(Date);
  });

  it('restores dates in cached schedule lists', async () => {
    cache.get.mockResolvedValue({
      items: [
        {
          id: 'schedule-id',
          objective: 'Consultation',
          customerId: 'customer-id',
          doctorId: 'doctor-id',
          scheduledAt: '2026-11-08T21:35:16.730Z',
          createdAt: '2026-11-08T21:35:16.730Z',
          updatedAt: '2026-11-08T21:35:16.730Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await service.findAll();

    expect(result.items[0].scheduledAt).toBeInstanceOf(Date);
    expect(result.items[0].createdAt).toBeInstanceOf(Date);
    expect(result.items[0].updatedAt).toBeInstanceOf(Date);
  });

  it('maps delete errors for missing schedules to not found', async () => {
    prisma.schedule.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.remove('missing-id')).rejects.toThrow(
      'Schedule not found',
    );
  });

  it('deletes a schedule, invalidates caches, and queues a cancellation email', async () => {
    const schedule = {
      id: 'schedule-id',
      objective: 'Consultation',
      scheduledAt: futureDate(),
      customer: { email: 'patient@example.com', name: 'Patient' },
      doctor: { name: 'Dr. Doe' },
    };
    const deleted = { id: 'schedule-id' };
    prisma.schedule.findUnique.mockResolvedValue(schedule);
    prisma.schedule.delete.mockResolvedValue(deleted);

    await expect(service.remove('schedule-id')).resolves.toBe(deleted);
    expect(cache.del).toHaveBeenCalledWith('schedules:detail:schedule-id');
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('schedules');
    expect(notifications.sendScheduleDeletedEmail).toHaveBeenCalledWith({
      customerEmail: 'patient@example.com',
      customerName: 'Patient',
      doctorName: 'Dr. Doe',
      objective: 'Consultation',
      scheduledAt: schedule.scheduledAt,
    });
  });

  it('continues creating a schedule when queueing its email fails', async () => {
    const scheduleInput = input();
    const created = { id: 'schedule-id', ...scheduleInput };
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-id',
      email: 'patient@example.com',
      name: 'Patient',
    });
    prisma.doctor.findUnique.mockResolvedValue({
      id: 'doctor-id',
      name: 'Dr. Doe',
    });
    prisma.schedule.findUnique.mockResolvedValue(null);
    prisma.schedule.create.mockResolvedValue(created);
    notifications.sendScheduleCreatedEmail.mockRejectedValue(
      new Error('queue unavailable'),
    );

    await expect(service.create(scheduleInput)).resolves.toBe(created);
  });

  it('maps database constraint errors while creating a schedule', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-id' });
    prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-id' });
    prisma.schedule.findUnique.mockResolvedValue(null);
    prisma.schedule.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.create(input())).rejects.toThrow(
      'Doctor already has a schedule at this time',
    );

    prisma.schedule.create.mockRejectedValueOnce({ code: 'P2003' });
    await expect(service.create(input())).rejects.toThrow(
      'Customer or Doctor does not exist',
    );
  });

  it('continues deleting a schedule when queueing its email fails', async () => {
    const schedule = {
      id: 'schedule-id',
      customer: { email: 'patient@example.com', name: 'Patient' },
      doctor: { name: 'Dr. Doe' },
    };
    prisma.schedule.findUnique.mockResolvedValue(schedule);
    prisma.schedule.delete.mockResolvedValue({ id: 'schedule-id' });
    notifications.sendScheduleDeletedEmail.mockRejectedValue(
      new Error('queue unavailable'),
    );

    await expect(service.remove('schedule-id')).resolves.toEqual({
      id: 'schedule-id',
    });
  });
});
