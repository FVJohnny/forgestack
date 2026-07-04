import {
  testCriteriaConverterContract,
  type TestEntityDTO,
} from '@libs/nestjs-common/test-exports';
import { RedisCriteriaConverter } from './criteria-converter.redis';
import { RedisTestService } from '../testing/redis-test.service';

describe('RedisCriteriaConverter', () => {
  const KEY_PREFIX = 'test_entities';
  const redisTestService = new RedisTestService<TestEntityDTO>(KEY_PREFIX);

  beforeAll(async () => {
    await redisTestService.setupDatabase();
  });

  beforeEach(async () => {
    await redisTestService.clear();
  });

  afterAll(async () => {
    await redisTestService.closeDatabase();
  });

  // Run the shared contract tests
  testCriteriaConverterContract('Redis Implementation', async (entities: TestEntityDTO[]) => {
    // Ensure complete data isolation for each test
    await redisTestService.clear();
    await redisTestService.setInitialData(entities);
    return new RedisCriteriaConverter<TestEntityDTO>(
      redisTestService.getDatabaseClient()!,
      KEY_PREFIX,
    );
  });
});
