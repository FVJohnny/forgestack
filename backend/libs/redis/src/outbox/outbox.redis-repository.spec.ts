import { Outbox_RedisRepository } from './outbox.redis-repository';
import { testOutboxRepositoryContract } from '@libs/nestjs-common/test-exports';
import { RedisTestService } from '../testing/redis-test.service';

describe('Outbox_RedisRepository', () => {
  const redisTestService = new RedisTestService();

  // Run the shared contract tests
  testOutboxRepositoryContract(
    'Redis Implementation',
    async () => new Outbox_RedisRepository(redisTestService),
    {
      beforeAll: async () => {
        await redisTestService.setupDatabase();
      },
      afterAll: async () => {
        await redisTestService.closeDatabase();
      },
      beforeEach: async () => await redisTestService.clear(),
    },
  );
});
