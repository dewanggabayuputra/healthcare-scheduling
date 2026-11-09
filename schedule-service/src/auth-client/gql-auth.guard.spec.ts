import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthClientService } from './auth-client.service';
import { GqlAuthGuard } from './gql-auth.guard';

jest.mock('./auth-client.service', () => ({
  AuthClientService: class AuthClientService {},
}));

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;
  let authClient: { validateToken: jest.Mock };
  let req: { headers: Record<string, string | undefined>; user?: unknown };
  let context: ExecutionContext;

  beforeEach(() => {
    authClient = { validateToken: jest.fn() };
    req = { headers: {} };
    context = {
      getType: () => 'graphql',
      getArgs: () => [null, null, { req }, null],
      getClass: () => class Resolver {},
      getHandler: () => () => undefined,
    } as ExecutionContext;
    guard = new GqlAuthGuard(authClient as unknown as AuthClientService);
  });

  it('requires a Bearer authorization header', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authClient.validateToken).not.toHaveBeenCalled();
  });

  it('rejects authorization schemes other than Bearer', async () => {
    req.headers.authorization = 'Basic token';

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authorization token is required',
    );
  });

  it('validates the token and attaches the user to the GraphQL request', async () => {
    const user = { id: 'user-id', email: 'user@example.com' };
    req.headers.authorization = 'Bearer access-token';
    authClient.validateToken.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authClient.validateToken).toHaveBeenCalledWith('access-token');
    expect(req.user).toBe(user);
  });
});
