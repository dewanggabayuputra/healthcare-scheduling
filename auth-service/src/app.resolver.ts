import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String)
  health(): string {
    return 'Auth Service is running';
  }
}