import { EntityExample, Example_InMemoryRepository } from '@libs/nestjs-common';
import { Transaction } from '@libs/nestjs-common';
import { RedisTestService } from '../testing/redis-test.service';
import { Example_RedisRepository } from '../example/example.redis-repository';

describe('Redis transactions', () => {
  const redisTestService = new RedisTestService();
  let repository: Example_RedisRepository;

  beforeAll(async () => {
    await redisTestService.setupDatabase();
    repository = new Example_RedisRepository(redisTestService);
  });

  afterEach(async () => {
    await redisTestService.clear();
  });

  afterAll(async () => {
    await redisTestService.closeDatabase();
  });

  it('persists all writes when every save succeeds', async () => {
    const aggregate = EntityExample.create({ value: 'first' });
    const aggregate2 = EntityExample.create({ value: 'second' });

    await Transaction.run(async (context) => {
      await repository.save(aggregate, context);
      await repository.save(aggregate2, context);
    });

    await expect(repository.findById(aggregate.id)).resolves.toMatchObject({
      value: 'first',
    });
    await expect(repository.findById(aggregate2.id)).resolves.toMatchObject({
      value: 'second',
    });
  });

  it('cancels writes when the second save throws exception', async () => {
    const aggregate = EntityExample.create({ value: 'first' });
    const aggregate2 = EntityExample.create({ value: 'second' });

    await expect(
      Transaction.run(async (context) => {
        await repository.save(aggregate, context);
        await repository.save(aggregate2, context);
        throw new Error('forced failure');
      }),
    ).rejects.toThrow('forced failure');

    await expect(repository.findById(aggregate.id)).resolves.toBeNull();
    await expect(repository.findById(aggregate2.id)).resolves.toBeNull();
  });

  describe('with in-memory participant', () => {
    let inMemoryRepository: Example_InMemoryRepository;

    beforeEach(() => {
      inMemoryRepository = new Example_InMemoryRepository();
    });

    it('commits redis and in-memory writes when successful', async () => {
      const aggregate = EntityExample.create({ value: 'in-memory-1' });

      await Transaction.run(async (context) => {
        await repository.save(aggregate, context);
        await inMemoryRepository.save(aggregate, context);
      });

      await expect(repository.exists(aggregate.id)).resolves.toBe(true);
      await expect(inMemoryRepository.exists(aggregate.id)).resolves.toBe(true);
    });

    it('rolls back in-memory and redis writes when an error occurs', async () => {
      const first = EntityExample.create({ value: 'in-memory-rollback' });
      const second = EntityExample.create({ value: 'in-memory-rollback-2' });

      await expect(
        Transaction.run(async (context) => {
          await repository.save(first, context);
          await inMemoryRepository.save(first, context);
          await repository.save(second, context);
          throw new Error('forced failure');
        }),
      ).rejects.toThrow('forced failure');

      await expect(repository.exists(first.id)).resolves.toBe(false);
      await expect(repository.exists(second.id)).resolves.toBe(false);
      await expect(inMemoryRepository.exists(first.id)).resolves.toBe(false);
    });
  });
});
