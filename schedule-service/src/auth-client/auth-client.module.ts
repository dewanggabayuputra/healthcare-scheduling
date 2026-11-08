import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthClientService } from './auth-client.service';
import { GqlAuthGuard } from './gql-auth.guard';

@Module({
  imports: [HttpModule.register({ timeout: 3000 })],
  providers: [AuthClientService, GqlAuthGuard],
  exports: [GqlAuthGuard],
})
export class AuthClientModule {}