import type { DistributedTransactionContext } from './distributed-transaction-context';

export interface RepositoryContext {
  readonly transaction: DistributedTransactionContext;
}
