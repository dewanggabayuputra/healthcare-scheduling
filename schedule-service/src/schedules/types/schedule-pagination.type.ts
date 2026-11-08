import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ScheduleType } from './schedule.type';

@ObjectType()
export class SchedulePaginationType {
  @Field(() => [ScheduleType])
  items: ScheduleType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}