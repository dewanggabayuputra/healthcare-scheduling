import { Field, InputType, ID, GraphQLISODateTime } from '@nestjs/graphql';
import {
  IsDate,
  IsNotEmpty,
  IsUUID,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateScheduleInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(500)
  objective: string;

  @Field(() => ID)
  @IsUUID()
  customerId: string;

  @Field(() => ID)
  @IsUUID()
  doctorId: string;

  @Field(() => GraphQLISODateTime)
  @IsDate()
  scheduledAt: Date;
}