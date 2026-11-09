import { CacheService } from './cache.service';

jest.mock('@nestjs/cache-manager', () => ({
  CACHE_MANAGER: 'CACHE_MANAGER',
}));

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    service = new CacheService(cacheManager as never);
  });

  it('gets a value from the cache', async () => {
    cacheManager.get.mockResolvedValue('cached');

    await expect(service.get('key')).resolves.toBe('cached');
    expect(cacheManager.get).toHaveBeenCalledWith('key');
  });

  it('returns undefined when reading the cache fails', async () => {
    cacheManager.get.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.get('key')).resolves.toBeUndefined();
  });

  it('sets a value with the requested TTL', async () => {
    await service.set('key', 'value', 1_000);

    expect(cacheManager.set).toHaveBeenCalledWith('key', 'value', 1_000);
  });

  it('uses the default TTL when setting a value', async () => {
    await service.set('key', 'value');

    expect(cacheManager.set).toHaveBeenCalledWith(
      'key',
      'value',
      300_000,
    );
  });

  it('does not throw when writing to the cache fails', async () => {
    cacheManager.set.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.set('key', 'value')).resolves.toBeUndefined();
  });

  it('deletes a cache value', async () => {
    await service.del('key');

    expect(cacheManager.del).toHaveBeenCalledWith('key');
  });

  it('does not throw when deleting from the cache fails', async () => {
    cacheManager.del.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.del('key')).resolves.toBeUndefined();
  });

  it('creates a namespace version when none exists', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    const before = Date.now();

    const version = await service.getNamespaceVersion('customers');

    expect(version).toMatch(/^\d+$/);
    expect(Number(version)).toBeGreaterThanOrEqual(before);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'customers:version',
      version,
      86_400_000,
    );
  });

  it('returns an existing namespace version', async () => {
    cacheManager.get.mockResolvedValue('existing-version');

    await expect(
      service.getNamespaceVersion('customers'),
    ).resolves.toBe('existing-version');
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('invalidates a namespace by replacing its version', async () => {
    const before = Date.now();

    await service.invalidateNamespace('customers');

    expect(cacheManager.set).toHaveBeenCalledWith(
      'customers:version',
      expect.any(String),
      86_400_000,
    );
    const version = cacheManager.set.mock.calls[0][1] as string;
    expect(Number(version)).toBeGreaterThanOrEqual(before);
  });
});
