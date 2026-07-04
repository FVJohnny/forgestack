import { RedisTestService } from '../testing/redis-test.service';
import { ThrottlerStorageRedis } from './throttler-storage.redis';

describe('ThrottlerStorageRedis', () => {
  const redisTestService = new RedisTestService();
  let storage: ThrottlerStorageRedis;

  beforeAll(async () => {
    await redisTestService.setupDatabase();
    storage = new ThrottlerStorageRedis(redisTestService);
  });

  afterEach(async () => {
    await redisTestService.clear();
  });

  afterAll(async () => {
    await redisTestService.closeDatabase();
  });

  it('counts hits within the ttl window', async () => {
    const first = await storage.increment('key-a', 60_000, 5, 60_000, 'default');
    const second = await storage.increment('key-a', 60_000, 5, 60_000, 'default');

    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);
    expect(second.totalHits).toBe(2);
    expect(second.timeToExpire).toBeGreaterThan(0);
  });

  it('blocks once the limit is exceeded and stays blocked', async () => {
    const limit = 2;
    await storage.increment('key-b', 60_000, limit, 60_000, 'default');
    await storage.increment('key-b', 60_000, limit, 60_000, 'default');

    const overLimit = await storage.increment('key-b', 60_000, limit, 60_000, 'default');
    expect(overLimit.isBlocked).toBe(true);
    expect(overLimit.timeToBlockExpire).toBeGreaterThan(0);

    // While blocked, further hits do not increment the counter.
    const whileBlocked = await storage.increment('key-b', 60_000, limit, 60_000, 'default');
    expect(whileBlocked.isBlocked).toBe(true);
    expect(whileBlocked.totalHits).toBe(overLimit.totalHits);
  });

  it('tracks keys independently', async () => {
    await storage.increment('key-c', 60_000, 5, 60_000, 'default');
    const other = await storage.increment('key-d', 60_000, 5, 60_000, 'default');

    expect(other.totalHits).toBe(1);
  });

  it('expires the hit window after the ttl', async () => {
    const first = await storage.increment('key-e', 50, 5, 50, 'default');
    expect(first.totalHits).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 120));

    const afterExpiry = await storage.increment('key-e', 50, 5, 50, 'default');
    expect(afterExpiry.totalHits).toBe(1);
  });
});
