import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthClientService } from './auth-client.service';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly authClientService: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    const authorization = req.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token is required');
    }

    const token = authorization.substring(7);

    const user = await this.authClientService.validateToken(token);

    req.user = user;

    return true;
  }
}