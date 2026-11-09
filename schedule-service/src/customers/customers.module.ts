import { Module } from '@nestjs/common';
import { AppCacheModule } from '../cache/cache.module';
import { CustomersResolver } from './customers.resolver';
import { CustomersService } from './customers.service';

@Module({
  imports: [AppCacheModule],
  providers: [CustomersResolver, CustomersService],
})
export class CustomersModule {}