import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
} from '@nestjs/graphql';

import { DoctorsService } from './doctors.service';
import { DoctorType } from './types/doctor.type';
import { DoctorPaginationType } from './types/doctor-pagination.type';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';

@Resolver(() => DoctorType)
export class DoctorsResolver {
  constructor(
    private readonly doctorsService: DoctorsService,
  ) {}

  @Mutation(() => DoctorType)
  createDoctor(
    @Args('input') input: CreateDoctorInput,
  ) {
    return this.doctorsService.create(input);
  }

  @Query(() => DoctorPaginationType)
  doctors(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ) {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new Error('Invalid pagination parameters');
    }

    return this.doctorsService.findAll(page, limit);
  }

  @Query(() => DoctorType)
  doctor(@Args('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Mutation(() => DoctorType)
  updateDoctor(
    @Args('id') id: string,
    @Args('input') input: UpdateDoctorInput,
  ) {
    return this.doctorsService.update(id, input);
  }

  @Mutation(() => DoctorType)
  deleteDoctor(@Args('id') id: string) {
    return this.doctorsService.remove(id);
  }
}