import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { CacheService } from '../cache/cache.service';
import { restoreDate } from '../cache/date.utils';

type CachedCustomer = {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CachedCustomerPage = {
  items: CachedCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function restoreCustomerDates(customer: CachedCustomer) {
  return {
    ...customer,
    createdAt: restoreDate(customer.createdAt),
    updatedAt: restoreDate(customer.updatedAt),
  };
}

@Injectable()
export class CustomersService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly cacheService: CacheService,
) {}

  async create(input: CreateCustomerInput) {
    try {
      const customer = await this.prisma.customer.create({
        data: input,
      });

      await this.cacheService.invalidateNamespace('customers');

      return customer;
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new ConflictException('Customer email already exists');
      }
      throw error;
    }
  }

  async findAll(page = 1, limit = 10) {
    const version = await this.cacheService.getNamespaceVersion('customers');

    const cacheKey = `customers:list:${version}:${page}:${limit}`;

    // Check cache
    const cachedData = await this.cacheService.get<CachedCustomerPage>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      return {
        ...cachedData,
        items: cachedData.items.map(restoreCustomerDates),
      };
    }

    // Cache miss: query database
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customer.count(),
    ]);

    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Save to Redis for 5 minutes
    await this.cacheService.set(cacheKey, result, 300_000);

    return result;
  }

  async findOne(id: string) {
    const cacheKey = `customers:detail:${id}`;

    const cachedData = await this.cacheService.get<CachedCustomer>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      return restoreCustomerDates(cachedData);
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.cacheService.set(
      cacheKey,
      customer,
      300_000,
    );

    return customer;
  }

  async update(id: string, input: UpdateCustomerInput) {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: input,
      });

      await this.cacheService.del(`customers:detail:${id}`);

      await this.cacheService.invalidateNamespace('customers');

      return customer;
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new ConflictException('Customer email already exists');
      }

      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Customer not found');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const customer = await this.prisma.customer.delete({
        where: { id },
      });

      await this.cacheService.del(`customers:detail:${id}`);
      await this.cacheService.invalidateNamespace('customers');

      return customer;
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Customer not found');
      }

      if ((error as any).code === 'P2003') {
        throw new ConflictException(
          'Cannot delete customer with existing schedules',
        );
      }

      throw error;
    }
  }
}