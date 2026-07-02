import type { DateVO, Repository } from '../../general';
import type { InboxEvent } from './inbox.aggregate';
import type { Id } from '../../general';
import type { RepositoryContext } from '../../transactions';
import type { InboxStatusVO } from './value-objects';

export interface InboxRepository extends Repository<InboxEvent, Id> {
  save(event: InboxEvent, context?: RepositoryContext): Promise<void>;
  findPendingEvents(limit?: number): Promise<InboxEvent[]>;
  /**
   * Atomically finds pending events AND marks them as processing.
   * This prevents race conditions where multiple consumers pick up the same events.
   * Returns the claimed events (already marked as processing).
   */
  claimPendingEvents(limit?: number): Promise<InboxEvent[]>;
  findByStatus(status: InboxStatusVO, limit?: number): Promise<InboxEvent[]>;
  deleteProcessed(olderThan: DateVO, context?: RepositoryContext): Promise<void>;
}
