import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterInput } from './dto/schedule-filter.input';
import { CacheService } from '../cache/cache.service';
import { restoreDate } from '../cache/date.utils';
import { Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

type CachedSchedule = {
  id: string;
  objective: string;
  customerId: string;
  doctorId: string;
  scheduledAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CachedSchedulePage = {
  items: CachedSchedule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function restoreScheduleDates(schedule: CachedSchedule) {
  return {
    ...schedule,
    scheduledAt: restoreDate(schedule.scheduledAt),
    createdAt: restoreDate(schedule.createdAt),
    updatedAt: restoreDate(schedule.updatedAt),
  };
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly notificationsService: NotificationsService,
  ) {}
  
  private readonly logger = new Logger(SchedulesService.name);

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
      const schedule = await this.prisma.schedule.create({
        data: {
          objective: input.objective.trim(),
          customerId: input.customerId,
          doctorId: input.doctorId,
          scheduledAt: input.scheduledAt,
        },
      });

      await this.cacheService.invalidateNamespace('schedules');

      // Enqueue email notification asynchronously
      try {
        await this.notificationsService.sendScheduleCreatedEmail({
          customerEmail: customer.email,
          customerName: customer.name,
          doctorName: doctor.name,
          objective: schedule.objective,
          scheduledAt: schedule.scheduledAt,
        });
      } catch (error) {
        this.logger.error(
          'Failed to enqueue schedule email notification',
          error instanceof Error ? error.stack : String(error),
        );
      }

      return schedule;
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
    if (
      filter?.fromDate &&
      filter?.toDate &&
      filter.fromDate > filter.toDate
    ) {
      throw new BadRequestException(
        'fromDate must be earlier than or equal to toDate',
      );
    }

    const normalizedFilter = {
      customerId: filter?.customerId ?? null,
      doctorId: filter?.doctorId ?? null,
      fromDate: filter?.fromDate?.toISOString() ?? null,
      toDate: filter?.toDate?.toISOString() ?? null,
    };

    const version =
      await this.cacheService.getNamespaceVersion('schedules');

    const cacheKey = `schedules:list:${version}:${JSON.stringify({
      ...normalizedFilter,
      page,
      limit,
    })}`;

    const cachedData = await this.cacheService.get<CachedSchedulePage>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      console.log('SCHEDULE CACHE HIT');
      return {
        ...cachedData,
        items: cachedData.items.map(restoreScheduleDates),
      };
    }
    console.log('SCHEDULE CACHE MISS');

    const skip = (page - 1) * limit;

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

    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 60_000);

    return result;
  }

  async findOne(id: string) {
    const cacheKey = `schedules:detail:${id}`;

    const cachedData = await this.cacheService.get<CachedSchedule>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      return restoreScheduleDates(cachedData);
    }

    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    await this.cacheService.set(cacheKey, schedule, 60_000);

    return schedule;
  }

  async remove(id: string) {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id },
        include: {
          customer: true,
          doctor: true,
        },
      });

      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      const deletedSchedule = await this.prisma.schedule.delete({
        where: { id },
      });

      await this.cacheService.del(`schedules:detail:${id}`);
      await this.cacheService.invalidateNamespace('schedules');

      // Send cancellation notification asynchronously
      try {
        await this.notificationsService.sendScheduleDeletedEmail({
          customerEmail: schedule.customer.email,
          customerName: schedule.customer.name,
          doctorName: schedule.doctor.name,
          objective: schedule.objective,
          scheduledAt: schedule.scheduledAt,
        });
      } catch (error) {
        this.logger.error(
          'Failed to enqueue cancellation email',
          error instanceof Error ? error.stack : String(error),
        );
      }

      return deletedSchedule;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Schedule not found');
      }

      throw error;
    }
  }
}