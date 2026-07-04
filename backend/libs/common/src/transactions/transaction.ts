import type { RepositoryContext } from './repository-context';
import { DistributedTransactionContext } from './distributed-transaction-context';
import { CorrelationLogger } from '../logger';
import { WithSpan } from '../tracing';

const MAX_TRANSACTION_RETRIES = 3;
const RETRY_DELAY_MS = 100;

export class Transaction {
  protected readonly logger: CorrelationLogger = new CorrelationLogger(this.constructor.name);

  @WithSpan('transaction.run')
  static async run(work: (context: RepositoryContext) => Promise<void>): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      const transactionContext = new DistributedTransactionContext();

      try {
        await work({ transaction: transactionContext });
        await this.commit(transactionContext);
        return; // Success
      } catch (error) {
        await this.rollback(transactionContext);
        lastError = error;

        // Check if it's a transient error that should be retried
        if (this.isTransientError(error) && attempt < MAX_TRANSACTION_RETRIES) {
          await this.delay(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw error;
      } finally {
        await this.dispose(transactionContext);
      }
    }

    throw lastError;
  }

  private static isTransientError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      // Check for MongoDB TransientTransactionError label
      const errorLabels = (error as { errorLabels?: string[] }).errorLabels;
      if (errorLabels?.includes('TransientTransactionError')) {
        return true;
      }

      // Check nested cause for TransientTransactionError
      const cause = (error as { cause?: { errorLabels?: string[] } }).cause;
      if (cause?.errorLabels?.includes('TransientTransactionError')) {
        return true;
      }

      // Check for WriteConflict error code (112)
      const code = (error as { code?: number }).code;
      const causeCode = (cause as { code?: number } | undefined)?.code;
      if (code === 112 || causeCode === 112) {
        return true;
      }
    }
    return false;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @WithSpan('transaction.commit')
  private static async commit(transactionContext: DistributedTransactionContext): Promise<void> {
    await transactionContext.commit();
  }

  @WithSpan('transaction.rollback')
  private static async rollback(transactionContext: DistributedTransactionContext): Promise<void> {
    await transactionContext.rollback();
  }

  @WithSpan('transaction.dispose')
  private static async dispose(transactionContext: DistributedTransactionContext): Promise<void> {
    await transactionContext.dispose();
  }
}
