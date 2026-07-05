import { EntityExample, type EntityExampleDTO } from '@libs/nestjs-common';
import type { MongoClient } from 'mongodb';

import { Base_MongoRepository, type IndexSpec } from './base.mongo-repository';
import { MongodbTestService } from '../testing/mongodb-test.service';

/**
 * Item 131: the static index-init lock must not cache a rejected promise
 * forever (a boot-time Mongo hiccup would poison the collection until process
 * restart), and dropping a collection must invalidate the lock so the unique
 * `id` index is recreated instead of trusted while absent.
 */
class IndexLockTestRepository extends Base_MongoRepository<EntityExample, EntityExampleDTO> {
  static failNextInit = false;

  constructor(mongoClient: MongoClient, collectionName: string) {
    super(mongoClient, collectionName);
  }

  protected toEntity(dto: EntityExampleDTO): EntityExample {
    return EntityExample.fromValue(dto);
  }

  protected defineIndexes(): IndexSpec[] {
    if (IndexLockTestRepository.failNextInit) {
      IndexLockTestRepository.failNextInit = false;
      throw new Error('simulated index init failure');
    }
    return [];
  }
}

describe('Base_MongoRepository index initialization lock', () => {
  const collectionName = 'index-lock-test';
  const svc = new MongodbTestService<EntityExampleDTO>(collectionName);

  beforeAll(() => svc.setupDatabase());
  beforeEach(async () => {
    await svc.cleanup();
    IndexLockTestRepository.failNextInit = false;
  });
  afterAll(() => svc.cleanup());

  const hasUniqueIdIndex = async () => {
    const indexes = await svc.mongoClient.db().collection(collectionName).indexes();
    return indexes.some((idx) => idx.name === 'ux_aggregate_id');
  };

  it('retries index initialization after a failed first attempt', async () => {
    IndexLockTestRepository.failNextInit = true;
    const repo = new IndexLockTestRepository(svc.mongoClient, collectionName);

    await expect(repo.ensureIndexes()).rejects.toThrow('simulated index init failure');

    // The rejected attempt must have been evicted, so this retries and works.
    await expect(repo.ensureIndexes()).resolves.toBeUndefined();
    expect(await hasUniqueIdIndex()).toBe(true);
  });

  it('shares one successful init across instances of the same collection', async () => {
    const first = new IndexLockTestRepository(svc.mongoClient, collectionName);
    await first.ensureIndexes();

    // A second instance must reuse the memoized lock, not re-run init: make a
    // re-run impossible to miss by arming the failure flag.
    IndexLockTestRepository.failNextInit = true;
    const second = new IndexLockTestRepository(svc.mongoClient, collectionName);
    await expect(second.ensureIndexes()).resolves.toBeUndefined();
    IndexLockTestRepository.failNextInit = false;
  });

  it('recreates the unique id index after the collection is dropped', async () => {
    const repo = new IndexLockTestRepository(svc.mongoClient, collectionName);
    await repo.ensureIndexes();
    expect(await hasUniqueIdIndex()).toBe(true);

    // cleanup() drops the collection AND invalidates the lock.
    await svc.cleanup();

    await repo.ensureIndexes();
    expect(await hasUniqueIdIndex()).toBe(true);
  });
});
