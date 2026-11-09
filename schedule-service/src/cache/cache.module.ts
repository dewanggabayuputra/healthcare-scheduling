import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        stores: [
          new KeyvRedis({
            socket: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT || 6379),
            },
          }),
        ],
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}