import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.warn(`Cache GET failed: ${key}`);
      return undefined;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl = 300_000,
  ): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.warn(`Cache SET failed: ${key}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Cache DELETE failed: ${key}`);
    }
  }

  async getNamespaceVersion(namespace: string): Promise<string> {
    const key = `${namespace}:version`;

    let version = await this.get<string>(key);

    if (!version) {
      version = Date.now().toString();
      await this.set(key, version, 86_400_000);
    }

    return version;
  }

  async invalidateNamespace(namespace: string): Promise<void> {
    const key = `${namespace}:version`;

    await this.set(key, Date.now().toString(), 86_400_000);
  }
}