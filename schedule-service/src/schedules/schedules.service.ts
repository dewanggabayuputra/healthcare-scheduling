import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterInput } from './dto/schedule-filter.input';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateScheduleInput) {
    if (
      input.scheduledAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Schedule must be in the future',
      );
    }

    // Validate customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate doctor
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: input.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Early check for an existing appointment
    const existingSchedule = await this.prisma.schedule.findUnique({
      where: {
        doctorId_scheduledAt: {
          doctorId: input.doctorId,
          scheduledAt: input.scheduledAt,
        },
      },
    });

    if (existingSchedule) {
      throw new ConflictException(
        'Doctor already has a schedule at this time',
      );
    }

    try {
      return await this.prisma.schedule.create({
        data: {
          objective: input.objective.trim(),
          customerId: input.customerId,
          doctorId: input.doctorId,
          scheduledAt: input.scheduledAt,
        },
      });
    } catch (error) {
      // Database-level protection against concurrent requests
      if ((error as any).code === 'P2002') {
        throw new ConflictException(
          'Doctor already has a schedule at this time',
        );
      }

      if ((error as any).code === 'P2003') {
        throw new NotFoundException(
          'Customer or Doctor does not exist',
        );
      }

      throw error;
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    filter?: ScheduleFilterInput,
  ) {
    const skip = (page - 1) * limit;

    if (
      filter?.fromDate &&
      filter?.toDate &&
      filter.fromDate > filter.toDate
    ) {
      throw new BadRequestException(
        'fromDate must be earlier than or equal to toDate',
      );
    }

    const where = {
      ...(filter?.customerId && {
        customerId: filter.customerId,
      }),
      ...(filter?.doctorId && {
        doctorId: filter.doctorId,
      }),
      ...(filter?.fromDate || filter?.toDate
        ? {
            scheduledAt: {
              ...(filter.fromDate && {
                gte: filter.fromDate,
              }),
              ...(filter.toDate && {
                lte: filter.toDate,
              }),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.schedule.count({ where }),
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
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async remove(id: string) {
    try {
      return await this.prisma.schedule.delete({
        where: { id },
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Schedule not found');
      }

      throw error;
    }
  }
}