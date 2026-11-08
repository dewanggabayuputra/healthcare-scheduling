import { Field, ID, ObjectType, GraphQLISODateTime } from '@nestjs/graphql';

@ObjectType()
export class CustomerType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}