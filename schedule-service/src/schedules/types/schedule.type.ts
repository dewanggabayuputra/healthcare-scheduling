import {
  Field,
  ID,
  ObjectType,
  GraphQLISODateTime,
} from '@nestjs/graphql';

@ObjectType()
export class ScheduleType {
  @Field(() => ID)
  id: string;

  @Field()
  objective: string;

  @Field(() => ID)
  customerId: string;

  @Field(() => ID)
  doctorId: string;

  @Field(() => GraphQLISODateTime)
  scheduledAt: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}