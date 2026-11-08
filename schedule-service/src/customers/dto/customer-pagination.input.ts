import { InputType, Field, Int } from '@nestjs/graphql';
import { Min, Max } from 'class-validator';

@InputType()
export class CustomerPaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 10 })
  @Min(1)
  @Max(100)
  limit = 10;
}