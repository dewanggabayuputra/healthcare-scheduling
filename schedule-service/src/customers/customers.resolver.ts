import { BadRequestException } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';

import { CustomersService } from './customers.service';
import { CustomerType } from './types/customer.type';
import { CustomerPaginationType } from './types/customer-pagination.type';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { CustomerPaginationInput } from './dto/customer-pagination.input';

@Resolver(() => CustomerType)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Mutation(() => CustomerType)
  createCustomer(@Args('input') input: CreateCustomerInput) {
    return this.customersService.create(input);
  }

  @Query(() => CustomerPaginationType)
  customers(
    @Args('pagination', {
      type: () => CustomerPaginationInput,
      nullable: true,
    })
    pagination?: CustomerPaginationInput,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    const resolvedPage = pagination?.page ?? page ?? 1;
    const resolvedLimit = pagination?.limit ?? limit ?? 10;

    if (resolvedPage < 1 || resolvedLimit < 1 || resolvedLimit > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return this.customersService.findAll(resolvedPage, resolvedLimit);
  }

  @Query(() => CustomerType)
  customer(@Args('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Mutation(() => CustomerType)
  updateCustomer(
    @Args('id') id: string,
    @Args('input') input: UpdateCustomerInput,
  ) {
    return this.customersService.update(id, input);
  }

  @Mutation(() => CustomerType)
  deleteCustomer(@Args('id') id: string) {
    return this.customersService.remove(id);
  }
}
