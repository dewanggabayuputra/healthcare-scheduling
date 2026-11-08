import { Field, Int, ObjectType } from '@nestjs/graphql';
import { DoctorType } from './doctor.type';

@ObjectType()
export class DoctorPaginationType {
  @Field(() => [DoctorType])
  items: DoctorType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}