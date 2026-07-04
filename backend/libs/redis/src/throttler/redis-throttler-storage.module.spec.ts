import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiRateLimitModule } from '@libs/nestjs-common';
import { ThrottlerStorage, getStorageToken } from '@nestjs/throttler';
import { RedisService } from '../redis.service';
import { RedisTestService } from '../testing/redis-test.service';
import { RedisThrottlerStorageModule } from './redis-throttler-storage.module';
import { ThrottlerStorageRedis } from './throttler-storage.redis';

describe('RedisThrottlerStorageModule wiring', () => {
  const redisTestService = new RedisTestService();

  // Stands in for the app's global RedisDBModule. Only exposes the client
  // getter (no lifecycle hooks), so moduleRef.close() cannot disconnect the
  // shared test connection before afterAll cleanup runs.
  @Global()
  @Module({
    providers: [
      {
        provide: RedisService,
        useValue: { getDatabaseClient: () => redisTestService.getDatabaseClient() },
      },
    ],
    exports: [RedisService],
  })
  class RedisStubModule {}

  beforeAll(async () => {
    await redisTestService.setupDatabase();
  });

  afterAll(async () => {
    await redisTestService.closeDatabase();
  });

  it('resolves ThrottlerStorageRedis as the throttler storage', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        RedisStubModule,
        ApiRateLimitModule.forRoot(
          { '1minute': { type: 'ip', limit: 100 } },
          { imports: [RedisThrottlerStorageModule], storageClass: ThrottlerStorageRedis },
        ),
      ],
    }).compile();

    const storage = moduleRef.get<ThrottlerStorage>(getStorageToken(), { strict: false });
    expect(storage).toBeInstanceOf(ThrottlerStorageRedis);

    const record = await storage.increment('wiring-test', 60_000, 5, 60_000, 'default');
    expect(record.totalHits).toBe(1);

    await moduleRef.close();
  });
});
