import { testOutboxRepositoryContract } from './outbox.repository.contract';

describe('OutboxRepository Contract Test Suite', () => {
  it('exports testOutboxRepositoryContract function', () => {
    expect(typeof testOutboxRepositoryContract).toBe('function');
  });
});
