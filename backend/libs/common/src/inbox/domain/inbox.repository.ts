import type { DateVO, Repository } from '../../general';
import type { InboxEvent } from './inbox.aggregate';
import type { Id } from '../../general';
import type { RepositoryContext } from '../../transactions';
import type { InboxStatusVO } from './value-objects';

export interface InboxRepository extends Repository<InboxEvent, Id> {
  save(event: InboxEvent, context?: RepositoryContext): Promise<void>;
  /**
   * Atomically inserts a new inbox event, relying on the unique `id` index for
   * deduplication. Returns true if inserted, false if an event with the same
   * id already exists. Use this instead of check-then-save so two concurrent
   * deliveries of the same message cannot both be accepted (and the second
   * cannot overwrite the first's status).
   */
  insertIfNew(event: InboxEvent): Promise<boolean>;
  findPendingEvents(limit?: number): Promise<InboxEvent[]>;
  /**
   * Atomically finds pending events AND marks them as processing.
   * This prevents race conditions where multiple consumers pick up the same events.
   * Returns the claimed events (already marked as processing).
   */
  claimPendingEvents(limit?: number): Promise<InboxEvent[]>;
  findByStatus(status: InboxStatusVO, limit?: number): Promise<InboxEvent[]>;
  /**
   * Recovers events stuck in the PROCESSING state since before `stuckSince`
   * (the instance crashed after claiming but before finishing) by returning
   * them to PENDING, or dead-lettering them once retries are exhausted.
   * Returns the number of events reclaimed.
   */
  reclaimStuckEvents(stuckSince: Date): Promise<number>;
  deleteProcessed(olderThan: DateVO, context?: RepositoryContext): Promise<void>;
}
