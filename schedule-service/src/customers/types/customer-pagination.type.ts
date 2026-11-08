import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CustomerType } from './customer.type';

@ObjectType()
export class CustomerPaginationType {
  @Field(() => [CustomerType])
  items: CustomerType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}