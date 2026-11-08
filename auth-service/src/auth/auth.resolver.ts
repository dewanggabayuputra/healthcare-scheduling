import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { UserType } from './types/user.type';
import { AuthResponseType } from './types/auth-response.type';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => UserType)
  async register(
    @Args('input') input: RegisterInput,
  ) {
    return this.authService.register(input);
  }

  @Mutation(() => AuthResponseType)
  async login(
    @Args('input') input: LoginInput,
  ) {
    return this.authService.login(input);
  }

  @Query(() => UserType)
  async validateToken(
    @Args('token') token: string,
  ) {
    return this.authService.validateToken(token);
  }
}