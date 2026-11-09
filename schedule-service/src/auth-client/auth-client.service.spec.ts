import type { ConfigService } from '@nestjs/config';
import type { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuthClientService } from './auth-client.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('@nestjs/axios', () => ({
  HttpService: class HttpService {},
}));

describe('AuthClientService', () => {
  let service: AuthClientService;
  let httpService: { post: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    httpService = { post: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('http://auth/graphql') };
    service = new AuthClientService(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
  });

  it('returns the validated user from the auth service', async () => {
    const user = { id: 'user-id', email: 'user@example.com' };
    httpService.post.mockReturnValue(of({ data: { data: { validateToken: user } } }));

    await expect(service.validateToken('valid-token')).resolves.toBe(user);
    expect(configService.getOrThrow).toHaveBeenCalledWith('AUTH_SERVICE_URL');
    expect(httpService.post).toHaveBeenCalledWith(
      'http://auth/graphql',
      expect.objectContaining({ variables: { token: 'valid-token' } }),
    );
  });

  it('rejects invalid tokens returned by GraphQL', async () => {
    httpService.post.mockReturnValue(
      of({ data: { errors: [{ message: 'invalid' }], data: null } }),
    );

    await expect(service.validateToken('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an empty validation response', async () => {
    httpService.post.mockReturnValue(of({ data: { data: {} } }));

    await expect(service.validateToken('missing-user')).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('maps auth service transport failures to service unavailable', async () => {
    httpService.post.mockReturnValue(
      throwError(() => new Error('connection refused')),
    );

    await expect(service.validateToken('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
