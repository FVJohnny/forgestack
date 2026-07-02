import { Outbox_InMemoryRepository } from './outbox.in-memory-repository';
import { testOutboxRepositoryContract } from '../domain/outbox.repository.contract';

describe('Outbox_InMemoryRepository', () => {
  // Run the shared contract tests

  const repository = new Outbox_InMemoryRepository();
  testOutboxRepositoryContract(
    'In-Memory Implementation',
    async () => {
      return repository;
    },
    { beforeEach: () => repository.clear() },
    // No cleanup needed for in-memory implementation
  );
});
