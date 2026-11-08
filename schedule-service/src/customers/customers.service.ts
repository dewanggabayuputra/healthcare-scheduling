import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCustomerInput) {
    try {
      return await this.prisma.customer.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new ConflictException('Customer email already exists');
      }
      throw error;
    }
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, input: UpdateCustomerInput) {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: {
          ...(input.name !== undefined && {
            name: input.name.trim(),
          }),
          ...(input.email !== undefined && {
            email: input.email.trim().toLowerCase(),
          }),
        },
      });
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
      return await this.prisma.customer.delete({
        where: { id },
      });
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