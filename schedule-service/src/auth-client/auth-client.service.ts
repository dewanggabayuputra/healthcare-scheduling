import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async validateToken(token: string) {
    const authServiceUrl =
      this.configService.getOrThrow<string>('AUTH_SERVICE_URL');

    try {
      const response = await firstValueFrom(
        this.httpService.post(authServiceUrl, {
          query: `
            query ValidateToken($token: String!) {
              validateToken(token: $token) {
                id
                email
              }
            }
          `,
          variables: { token },
        }),
      );

      const user = response.data?.data?.validateToken;

      if (response.data?.errors?.length || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Authentication service is unavailable',
      );
    }
  }
}