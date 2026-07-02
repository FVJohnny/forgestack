import { Base_InMemoryRepository } from '../../general/infrastructure';
import type { InboxRepository } from '../domain/inbox.repository';
import type { InboxEventDTO } from '../domain/inbox.aggregate';
import { InboxEvent } from '../domain/inbox.aggregate';
import type { RepositoryContext } from '../../transactions';
import type { InboxStatusVO } from '../domain/value-objects';
import type { DateVO } from '../../general';
import type { Id } from '../../general';

export class Inbox_InMemoryRepository
  extends Base_InMemoryRepository<InboxEvent, InboxEventDTO>
  implements InboxRepository
{
  // Secondary index: ids of events currently in PENDING status, in receivedAt order.
  // Inserting on save is O(1) when the new event's receivedAt is >= the latest (the
  // common case since receivedAt = InboxReceivedAt.now() when create() is called).
  // claimPendingEvents pops from the front in O(1) per claim. This avoids the O(N)
  // full-collection scan + sort that the previous findAll-based implementation did
  // on every poll tick.
  private readonly pendingIds: string[] = [];
  private readonly pendingIdSet: Set<string> = new Set();
  private lastPendingReceivedAtMs = -Infinity;

  protected toEntity(dto: InboxEventDTO): InboxEvent {
    return InboxEvent.fromValue(dto);
  }

  async save(entity: InboxEvent, context?: RepositoryContext): Promise<void> {
    await super.save(entity, context);
    this.indexByStatus(entity);
  }

  async remove(id: Id, context?: RepositoryContext): Promise<void> {
    await super.remove(id, context);
    this.dropFromPending(id.toValue());
  }

  async clear(context?: RepositoryContext): Promise<void> {
    await super.clear(context);
    this.pendingIds.length = 0;
    this.pendingIdSet.clear();
    this.lastPendingReceivedAtMs = -Infinity;
  }

  async findPendingEvents(limit = 100): Promise<InboxEvent[]> {
    const out: InboxEvent[] = [];
    for (const id of this.pendingIds) {
      if (out.length >= limit) break;
      const dto = this.items.get(id);
      if (dto) out.push(this.toEntity(dto));
    }
    return out;
  }

  async claimPendingEvents(limit = 100): Promise<InboxEvent[]> {
    const claimed: InboxEvent[] = [];
    while (claimed.length < limit && this.pendingIds.length > 0) {
      const id = this.pendingIds.shift()!;
      this.pendingIdSet.delete(id);
      const dto = this.items.get(id);
      if (!dto) continue;
      const event = this.toEntity(dto);
      if (!event.isPending()) continue;
      event.markAsProcessing();
      await this.save(event);
      claimed.push(event);
    }
    if (this.pendingIds.length === 0) this.lastPendingReceivedAtMs = -Infinity;
    return claimed;
  }

  async findByStatus(status: InboxStatusVO, limit = 100): Promise<InboxEvent[]> {
    const entities = await this.findAll();
    return entities
      .filter((event) => event.status.toValue() === status.toValue())
      .sort((a, b) => (a.receivedAt.isBefore(b.receivedAt) ? -1 : 1))
      .slice(0, limit);
  }

  async deleteProcessed(olderThan: DateVO, context?: RepositoryContext): Promise<void> {
    const entities = await this.findAll();
    const toDelete = entities.filter(
      (event) => event.isProcessed() && event.processedAt.isBefore(olderThan),
    );

    for (const event of toDelete) {
      await this.remove(event.id, context);
    }
  }

  private indexByStatus(entity: InboxEvent): void {
    const id = entity.id.toValue();
    if (entity.isPending()) {
      if (this.pendingIdSet.has(id)) return;
      const receivedAtMs = entity.receivedAt.toValue().getTime();
      if (receivedAtMs >= this.lastPendingReceivedAtMs) {
        this.pendingIds.push(id);
        this.lastPendingReceivedAtMs = receivedAtMs;
      } else {
        // Out-of-order insert (rare — only happens if an event is somehow
        // resurrected to PENDING with an older receivedAt). Insert in sorted
        // position to preserve FIFO. O(N) but only on this cold path.
        const insertAt = this.findInsertIndexByReceivedAt(receivedAtMs);
        this.pendingIds.splice(insertAt, 0, id);
      }
      this.pendingIdSet.add(id);
    } else {
      this.dropFromPending(id);
    }
  }

  private dropFromPending(id: string): void {
    if (!this.pendingIdSet.delete(id)) return;
    const idx = this.pendingIds.indexOf(id);
    if (idx >= 0) this.pendingIds.splice(idx, 1);
    if (this.pendingIds.length === 0) this.lastPendingReceivedAtMs = -Infinity;
  }

  private findInsertIndexByReceivedAt(receivedAtMs: number): number {
    for (let i = this.pendingIds.length - 1; i >= 0; i--) {
      const dto = this.items.get(this.pendingIds[i]);
      if (!dto) continue;
      if (new Date(dto.receivedAt).getTime() <= receivedAtMs) return i + 1;
    }
    return 0;
  }
}
