import { Field, InputType, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class ScheduleFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @IsDate()
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @IsDate()
  toDate?: Date;
}