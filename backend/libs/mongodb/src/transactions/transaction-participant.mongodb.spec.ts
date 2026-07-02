import type { EntityExampleDTO } from '@libs/nestjs-common';
import { EntityExample, Example_InMemoryRepository, Transaction } from '@libs/nestjs-common';
import { MongodbTestService } from '../testing/mongodb-test.service';
import { Example_MongoRepository } from '../example/example.mongo-repository';

describe('Mongo transactions', () => {
  const mongoTestService = new MongodbTestService<EntityExampleDTO>(
    Example_MongoRepository.CollectionName,
  );
  const mongoRepository = new Example_MongoRepository(mongoTestService.mongoClient);
  const inMemoryRepository = new Example_InMemoryRepository();

  beforeAll(async () => {
    await mongoTestService.setupDatabase();
    await mongoRepository.ensureIndexes();
  });

  beforeEach(async () => {
    await mongoTestService.clearCollection();
  });

  afterEach(async () => {
    await mongoTestService.clearCollection();
  });

  afterAll(async () => {
    await mongoTestService.cleanup();
  });

  it('commits all writes when each save succeeds', async () => {
    const firstAggregate = EntityExample.create({ value: 'value-1' });
    const secondAggregate = EntityExample.create({ value: 'value-2' });

    await Transaction.run(async (context) => {
      await mongoRepository.save(firstAggregate, context);
      await mongoRepository.save(secondAggregate, context);
    });

    await expect(mongoRepository.findById(firstAggregate.id)).resolves.toMatchObject({
      value: 'value-1',
    });
    await expect(mongoRepository.findById(secondAggregate.id)).resolves.toMatchObject({
      value: 'value-2',
    });
  });

  it('rolls back writes when a failure occurs', async () => {
    const firstAggregate = EntityExample.create({ value: 'value-1' });
    const secondAggregate = EntityExample.create({ value: 'value-2' });

    await expect(
      Transaction.run(async (context) => {
        await mongoRepository.save(firstAggregate, context);
        await mongoRepository.save(secondAggregate, context);
        throw new Error('forced failure');
      }),
    ).rejects.toThrow('forced failure');

    await expect(mongoRepository.findById(firstAggregate.id)).resolves.toBeNull();
    await expect(mongoRepository.findById(secondAggregate.id)).resolves.toBeNull();
  });

  describe('with in-memory participant', () => {
    it('commits both mongo and in-memory writes when successful', async () => {
      const aggregate = EntityExample.create({ value: 'composed-success' });

      await Transaction.run(async (context) => {
        await mongoRepository.save(aggregate, context);
        await inMemoryRepository.save(aggregate, context);
      });

      await expect(mongoRepository.findById(aggregate.id)).resolves.toMatchObject({
        value: 'composed-success',
      });
      await expect(inMemoryRepository.findById(aggregate.id)).resolves.toMatchObject({
        value: 'composed-success',
      });
    });

    it('rolls back mongo and in-memory writes when an error occurs', async () => {
      const aggregate = EntityExample.create({ value: 'composed-rollback' });

      await expect(
        Transaction.run(async (context) => {
          await mongoRepository.save(aggregate, context);
          await inMemoryRepository.save(aggregate, context);
          throw new Error('forced failure');
        }),
      ).rejects.toThrow('forced failure');

      await expect(mongoRepository.findById(aggregate.id)).resolves.toBeNull();
      await expect(inMemoryRepository.findById(aggregate.id)).resolves.toBeNull();
    });
  });
});
