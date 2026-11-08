import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDoctorInput) {
    return this.prisma.doctor.create({
      data: {
        name: input.name.trim(),
      },
    });
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.doctor.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.doctor.count(),
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
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async update(id: string, input: UpdateDoctorInput) {
    try {
      return await this.prisma.doctor.update({
        where: { id },
        data: {
          ...(input.name !== undefined && {
            name: input.name.trim(),
          }),
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Doctor not found');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.doctor.delete({
        where: { id },
      });
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