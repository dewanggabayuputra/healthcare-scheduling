import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String)
  health(): string {
    return 'Schedule Service is running';
  }
}