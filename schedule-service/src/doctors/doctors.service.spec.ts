import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { DoctorsService } from './doctors.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../cache/cache.service', () => ({
  CacheService: class CacheService {},
}));

describe('DoctorsService', () => {
  let service: DoctorsService;
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    getNamespaceVersion: jest.Mock;
    invalidateNamespace: jest.Mock;
  };
  let prisma: {
    doctor: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      del: jest.fn(),
      getNamespaceVersion: jest.fn().mockResolvedValue('version'),
      invalidateNamespace: jest.fn(),
    };
    prisma = {
      doctor: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(DoctorsService);
  });

  it('passes the doctor name to Prisma and invalidates the list cache', async () => {
    prisma.doctor.create.mockResolvedValue({
      id: 'doctor-id',
      name: 'Dr. Doe',
    });

    await service.create({ name: ' Dr. Doe ' });

    expect(prisma.doctor.create).toHaveBeenCalledWith({
      data: { name: ' Dr. Doe ' },
    });
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('doctors');
  });

  it('returns paginated doctors and calculates total pages', async () => {
    const items = [{ id: 'doctor-id' }];
    prisma.doctor.findMany.mockResolvedValue(items);
    prisma.doctor.count.mockResolvedValue(11);

    await expect(service.findAll()).resolves.toEqual({
      items,
      total: 11,
      page: 1,
      limit: 10,
      totalPages: 2,
    });
    expect(prisma.doctor.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.doctor.count).toHaveBeenCalled();
  });

  it('throws when the requested doctor does not exist', async () => {
    prisma.doctor.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(
      'Doctor not found',
    );
  });

  it('restores cached doctor timestamps to Date instances', async () => {
    cache.get.mockResolvedValue({
      id: 'doctor-id',
      name: 'Dr. Doe',
      createdAt: '2026-11-08T21:35:16.730Z',
      updatedAt: '2026-11-08T21:35:16.730Z',
    });

    const doctor = await service.findOne('doctor-id');

    expect(doctor.createdAt).toBeInstanceOf(Date);
    expect(doctor.updatedAt).toBeInstanceOf(Date);
  });

  it('restores timestamps in cached doctor lists', async () => {
    cache.get.mockResolvedValue({
      items: [
        {
          id: 'doctor-id',
          name: 'Dr. Doe',
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

    expect(result.items[0].createdAt).toBeInstanceOf(Date);
    expect(result.items[0].updatedAt).toBeInstanceOf(Date);
  });

  it('maps update errors for missing doctors to not found', async () => {
    prisma.doctor.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      service.update('missing-id', { name: 'Dr. Doe' }),
    ).rejects.toThrow('Doctor not found');
  });

  it('maps delete constraint errors to a conflict', async () => {
    prisma.doctor.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.remove('doctor-id')).rejects.toThrow(
      'Cannot delete doctor with existing schedules',
    );
  });

  it('caches a doctor returned from Prisma', async () => {
    const doctor = {
      id: 'doctor-id',
      name: 'Dr. Doe',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.doctor.findUnique.mockResolvedValue(doctor);

    await expect(service.findOne('doctor-id')).resolves.toBe(doctor);
    expect(cache.set).toHaveBeenCalledWith(
      'doctors:detail:doctor-id',
      doctor,
      300_000,
    );
  });

  it('updates a doctor and invalidates detail and list caches', async () => {
    const doctor = { id: 'doctor-id', name: 'Dr. New' };
    prisma.doctor.update.mockResolvedValue(doctor);

    await expect(
      service.update('doctor-id', { name: 'Dr. New' }),
    ).resolves.toBe(doctor);
    expect(cache.del).toHaveBeenCalledWith('doctors:detail:doctor-id');
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('doctors');
  });

  it('deletes a doctor and invalidates its caches', async () => {
    const doctor = { id: 'doctor-id', name: 'Dr. Doe' };
    prisma.doctor.delete.mockResolvedValue(doctor);

    await expect(service.remove('doctor-id')).resolves.toBe(doctor);
    expect(cache.del).toHaveBeenCalledWith('doctors:detail:doctor-id');
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('doctors');
  });

  it('maps update and delete errors for missing doctors to not found', async () => {
    prisma.doctor.update.mockRejectedValue({ code: 'P2025' });
    await expect(
      service.update('missing-id', { name: 'Dr. Doe' }),
    ).rejects.toThrow('Doctor not found');

    prisma.doctor.delete.mockRejectedValue({ code: 'P2025' });
    await expect(service.remove('missing-id')).rejects.toThrow(
      'Doctor not found',
    );
  });
});
