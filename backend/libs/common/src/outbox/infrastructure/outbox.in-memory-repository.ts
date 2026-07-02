import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxEventDTO } from '../domain/outbox.aggregate';
import { Outbox_Repository } from '../domain/outbox.repository';
import { Base_InMemoryRepository } from '../../general/infrastructure/base.in-memory-repository';
import { OutboxProcessedAt } from '../domain/value-objects';
import type { Id } from '../../general';

@Injectable()
export class Outbox_InMemoryRepository
  extends Base_InMemoryRepository<OutboxEvent, OutboxEventDTO>
  implements Outbox_Repository
{
  constructor(shouldThrowError = false) {
    super(shouldThrowError);
  }

  protected toEntity(dto: OutboxEventDTO): OutboxEvent {
    return OutboxEvent.fromValue(dto);
  }

  async findUnprocessed(limit = 10) {
    this.validate('findUnprocessed');
    return (await this.findAll())
      .filter((e) => e.processedAt.isNeverProcessed())
      .sort((a, b) => a.timestamps.createdAt.getTime() - b.timestamps.createdAt.getTime())
      .slice(0, limit);
  }

  async claimUnprocessedEvents(limit = 10): Promise<OutboxEvent[]> {
    this.validate('claimUnprocessedEvents');
    const unprocessed = await this.findUnprocessed(limit);

    // Mark as processing (simulate atomic claim)
    for (const event of unprocessed) {
      event.processedAt = OutboxProcessedAt.processing();
      await this.save(event);
    }

    return unprocessed;
  }

  async resetClaimedEvent(eventId: Id): Promise<void> {
    this.validate('resetClaimedEvent');
    const event = await this.findById(eventId);
    if (event) {
      event.processedAt = OutboxProcessedAt.never();
      await this.save(event);
    }
  }

  async reclaimStuckEvents(stuckSince: Date): Promise<number> {
    this.validate('reclaimStuckEvents');
    const allItems = await this.findAll();
    let reclaimed = 0;

    for (const event of allItems) {
      if (
        event.processedAt.isProcessing() &&
        event.timestamps.updatedAt.getTime() < stuckSince.getTime()
      ) {
        event.processedAt = OutboxProcessedAt.never();
        await this.save(event);
        reclaimed++;
      }
    }

    return reclaimed;
  }

  async deleteProcessed(before: Date) {
    this.validate('deleteProcessed');
    const allItems = await this.findAll();
    for (const event of allItems) {
      if (event.isProcessedBefore(before)) {
        await this.remove(event.id);
      }
    }
  }
}
