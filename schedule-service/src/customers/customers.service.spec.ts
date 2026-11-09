import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CustomersService } from './customers.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../cache/cache.service', () => ({
  CacheService: class CacheService {},
}));

describe('CustomersService', () => {
  let service: CustomersService;
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    getNamespaceVersion: jest.Mock;
    invalidateNamespace: jest.Mock;
  };
  let prisma: {
    customer: {
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
      customer: {
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
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(CustomersService);
  });

  it('passes customer fields to Prisma and invalidates the list cache', async () => {
    const customer = {
      id: 'customer-id',
      name: 'Patient',
      email: 'p@example.com',
    };
    prisma.customer.create.mockResolvedValue(customer);

    await expect(
      service.create({
        name: '  Patient ',
        email: ' P@Example.com ',
      }),
    ).resolves.toBe(customer);
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { name: '  Patient ', email: ' P@Example.com ' },
    });
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('customers');
  });

  it('maps duplicate email errors to a conflict', async () => {
    prisma.customer.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({ name: 'Patient', email: 'p@example.com' }),
    ).rejects.toThrow('Customer email already exists');
  });

  it('returns paginated customers and calculates total pages', async () => {
    const items = [{ id: 'customer-id' }];
    prisma.customer.findMany.mockResolvedValue(items);
    prisma.customer.count.mockResolvedValue(21);

    await expect(service.findAll(2, 10)).resolves.toEqual({
      items,
      total: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
    expect(prisma.customer.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.customer.count).toHaveBeenCalled();
  });

  it('throws when the requested customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(
      'Customer not found',
    );
  });

  it('restores cached customer timestamps to Date instances', async () => {
    cache.get.mockResolvedValue({
      id: 'customer-id',
      name: 'Patient',
      email: 'p@example.com',
      createdAt: '2026-11-08T21:35:16.730Z',
      updatedAt: '2026-11-08T21:35:16.730Z',
    });

    const customer = await service.findOne('customer-id');

    expect(customer.createdAt).toBeInstanceOf(Date);
    expect(customer.updatedAt).toBeInstanceOf(Date);
  });

  it('restores timestamps in cached customer lists', async () => {
    cache.get.mockResolvedValue({
      items: [
        {
          id: 'customer-id',
          name: 'Patient',
          email: 'p@example.com',
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

  it('passes provided fields to Prisma and invalidates cached customer data', async () => {
    prisma.customer.update.mockResolvedValue({ id: 'customer-id' });

    await service.update('customer-id', {
      name: '  Updated ',
      email: ' NEW@Example.com ',
    });

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-id' },
      data: { name: '  Updated ', email: ' NEW@Example.com ' },
    });
    expect(cache.del).toHaveBeenCalledWith('customers:detail:customer-id');
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('customers');
  });

  it('maps delete constraint errors to a conflict', async () => {
    prisma.customer.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.remove('customer-id')).rejects.toThrow(
      'Cannot delete customer with existing schedules',
    );
  });

  it('caches a customer returned from Prisma', async () => {
    const customer = {
      id: 'customer-id',
      name: 'Patient',
      email: 'p@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.customer.findUnique.mockResolvedValue(customer);

    await expect(service.findOne('customer-id')).resolves.toBe(customer);
    expect(cache.set).toHaveBeenCalledWith(
      'customers:detail:customer-id',
      customer,
      300_000,
    );
  });

  it('maps update errors to conflict and not found', async () => {
    prisma.customer.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      service.update('customer-id', { name: 'Patient' }),
    ).rejects.toThrow('Customer email already exists');

    prisma.customer.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(
      service.update('missing-id', { name: 'Patient' }),
    ).rejects.toThrow('Customer not found');
  });

  it('maps deletion of a missing customer to not found', async () => {
    prisma.customer.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.remove('missing-id')).rejects.toThrow(
      'Customer not found',
    );
  });

  it('deletes a customer and invalidates its caches', async () => {
    const customer = { id: 'customer-id' };
    prisma.customer.delete.mockResolvedValue(customer);

    await expect(service.remove('customer-id')).resolves.toBe(customer);
    expect(cache.del).toHaveBeenCalledWith('customers:detail:customer-id');
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('customers');
  });
});
