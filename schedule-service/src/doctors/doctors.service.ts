import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { CacheService } from '../cache/cache.service';
import { restoreDate } from '../cache/date.utils';

type CachedDoctor = {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CachedDoctorPage = {
  items: CachedDoctor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function restoreDoctorDates(doctor: CachedDoctor) {
  return {
    ...doctor,
    createdAt: restoreDate(doctor.createdAt),
    updatedAt: restoreDate(doctor.updatedAt),
  };
}

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(input: CreateDoctorInput) {
    const doctor = await this.prisma.doctor.create({
      data: input,
    });

    await this.cacheService.invalidateNamespace('doctors');

    return doctor;
  }

  async findAll(page = 1, limit = 10) {
    const version =
      await this.cacheService.getNamespaceVersion('doctors');

    const cacheKey =
      `doctors:list:${version}:${page}:${limit}`;

    const cachedData = await this.cacheService.get<CachedDoctorPage>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      return {
        ...cachedData,
        items: cachedData.items.map(restoreDoctorDates),
      };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.doctor.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.doctor.count(),
    ]);

    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, 300_000);

    return result;
  }

  async findOne(id: string) {
    const cacheKey = `doctors:detail:${id}`;

    const cachedData = await this.cacheService.get<CachedDoctor>(cacheKey);

    if (cachedData !== undefined && cachedData !== null) {
      return restoreDoctorDates(cachedData);
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    await this.cacheService.set(cacheKey, doctor, 300_000);

    return doctor;
  }

  async update(id: string, input: UpdateDoctorInput) {
    try {
      const doctor = await this.prisma.doctor.update({
        where: { id },
        data: input,
      });

      await this.cacheService.del(`doctors:detail:${id}`);
      await this.cacheService.invalidateNamespace('doctors');

      return doctor;
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Doctor not found');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const doctor = await this.prisma.doctor.delete({
        where: { id },
      });

      await this.cacheService.del(`doctors:detail:${id}`);
      await this.cacheService.invalidateNamespace('doctors');

      return doctor;
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Doctor not found');
      }

      if ((error as any).code === 'P2003') {
        throw new ConflictException(
          'Cannot delete doctor with existing schedules',
        );
      }

      throw error;
    }
  }
}