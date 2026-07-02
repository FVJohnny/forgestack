import type { TransactionParticipant } from './transaction-participant';
import type { Base_InMemoryRepository } from '../general/infrastructure/base.in-memory-repository';
import type { SharedAggregate, SharedAggregateDTO } from '../general/domain';

export class TransactionParticipant_InMemory<
  TEnt extends SharedAggregate,
  TDto extends SharedAggregateDTO,
> implements TransactionParticipant
{
  private readonly snapshots = new Map<Base_InMemoryRepository<TEnt, TDto>, Map<string, TDto>>();

  saveSnapshot(repository: Base_InMemoryRepository<TEnt, TDto>, snapshot: Map<string, TDto>) {
    if (!this.snapshots.has(repository)) {
      this.snapshots.set(repository, snapshot);
    }
  }

  async rollback() {
    for (const [repository, snapshot] of this.snapshots.entries()) {
      repository.restoreFromSnapshot(snapshot);
    }
    this.snapshots.clear();
  }

  async commit() {}

  async dispose() {
    this.snapshots.clear();
  }
}
