import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ID,
} from '@nestjs/graphql';

import { SchedulesService } from './schedules.service';
import { ScheduleType } from './types/schedule.type';
import { SchedulePaginationType } from './types/schedule-pagination.type';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterInput } from './dto/schedule-filter.input';

@Resolver(() => ScheduleType)
export class SchedulesResolver {
  constructor(
    private readonly schedulesService: SchedulesService,
  ) {}

  @Mutation(() => ScheduleType)
  createSchedule(
    @Args('input') input: CreateScheduleInput,
  ) {
    return this.schedulesService.create(input);
  }

  @Query(() => SchedulePaginationType)
  schedules(
    @Args('page', { type: () => Int, defaultValue: 1 })
    page: number,

    @Args('limit', { type: () => Int, defaultValue: 10 })
    limit: number,

    @Args('filter', {
      type: () => ScheduleFilterInput,
      nullable: true,
    })
    filter?: ScheduleFilterInput,
  ) {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new Error('Invalid pagination parameters');
    }

    return this.schedulesService.findAll(
      page,
      limit,
      filter,
    );
  }

  @Query(() => ScheduleType)
  schedule(
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.schedulesService.findOne(id);
  }

  @Mutation(() => ScheduleType)
  deleteSchedule(
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.schedulesService.remove(id);
  }
}