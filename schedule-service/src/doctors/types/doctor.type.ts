import {
  Field,
  ID,
  ObjectType,
  GraphQLISODateTime,
} from '@nestjs/graphql';

@ObjectType()
export class DoctorType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}