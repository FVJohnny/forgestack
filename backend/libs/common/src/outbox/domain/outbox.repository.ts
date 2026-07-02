import type { Repository } from '../../general';
import type { OutboxEvent } from './outbox.aggregate';
import type { Id } from '../../general';
import type { RepositoryContext } from '../../transactions';

export interface Outbox_Repository extends Repository<OutboxEvent, Id> {
  save(event: OutboxEvent, context?: RepositoryContext): Promise<void>;
  findUnprocessed(limit?: number): Promise<OutboxEvent[]>;
  /**
   * Atomically claims unprocessed events using findOneAndUpdate.
   * This prevents race conditions where the same event could be published twice.
   * Uses a special "processing" marker (far-future date) to indicate claimed events.
   */
  claimUnprocessedEvents(limit?: number): Promise<OutboxEvent[]>;
  /**
   * Resets a claimed event back to unprocessed state (for failed publishes).
   */
  resetClaimedEvent(eventId: Id): Promise<void>;
  /**
   * Reclaims events stuck in "processing" state for longer than the given threshold.
   * This handles the case where a service instance crashes after claiming an event
   * but before publishing it to Kafka.
   */
  reclaimStuckEvents(stuckSince: Date): Promise<number>;
  deleteProcessed(olderThan: Date): Promise<void>;
}
