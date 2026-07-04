import { Injectable, Inject } from '@nestjs/common';
import type { MongoClient, Filter } from 'mongodb';

import {
  OutboxEvent,
  OutboxProcessedAt,
  Outbox_Repository,
  type OutboxEventDTO,
  type RepositoryContext,
  type Id,
} from '@libs/nestjs-common';
import { Base_MongoRepository, IndexSpec } from '../infrastructure/base.mongo-repository';
import { MONGO_CLIENT_TOKEN } from '../mongodb.module';

@Injectable()
export class Outbox_MongodbRepository
  extends Base_MongoRepository<OutboxEvent, OutboxEventDTO>
  implements Outbox_Repository
{
  static CollectionName = 'outbox_events';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, Outbox_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: OutboxEventDTO): OutboxEvent {
    return OutboxEvent.fromValue(dto);
  }

  async findUnprocessed(limit = 100) {
    await this.ensureIndexes();
    // Safe type assertion - we know OutboxEventDTO has processedAt field
    const filter: Filter<OutboxEventDTO> = {
      processedAt: OutboxProcessedAt.never().toValue(),
    } as Filter<OutboxEventDTO>;

    const cursor = this.collection.find(filter).sort({ createdAt: 1 }).limit(limit);

    const docs = await cursor.toArray();
    return docs.map((d) => OutboxEvent.fromValue(d as OutboxEventDTO));
  }

  /**
   * Atomically claims unprocessed events using findOneAndUpdate.
   * Each event is claimed individually to ensure no race conditions.
   * Uses MongoDB's atomic findOneAndUpdate to guarantee that only one consumer
   * can claim each event, even under concurrent access.
   */
  async claimUnprocessedEvents(limit = 10): Promise<OutboxEvent[]> {
    await this.ensureIndexes();

    const claimedEvents: OutboxEvent[] = [];
    const processingMarker = OutboxProcessedAt.processing().toValue();

    // Use findOneAndUpdate in a loop for atomic claiming
    // This ensures no race conditions - each event can only be claimed once
    for (let i = 0; i < limit; i++) {
      const doc = await this.collection.findOneAndUpdate(
        { processedAt: OutboxProcessedAt.never().toValue() } as Filter<OutboxEventDTO>,
        { $set: { processedAt: processingMarker, updatedAt: new Date() } },
        {
          sort: { createdAt: 1 },
          returnDocument: 'after',
        },
      );

      if (!doc) {
        // No more pending events
        break;
      }

      claimedEvents.push(OutboxEvent.fromValue(doc as OutboxEventDTO));
    }

    return claimedEvents;
  }

  /**
   * Resets a claimed event back to unprocessed state (for failed publishes).
   */
  async resetClaimedEvent(eventId: Id): Promise<void> {
    await this.collection.updateOne({ id: eventId.toValue() } as Filter<OutboxEventDTO>, {
      $set: { processedAt: OutboxProcessedAt.never().toValue() },
    });
  }

  /**
   * Reclaims events stuck in "processing" state since before the given date.
   * Resets them to unprocessed so they can be picked up again.
   */
  async reclaimStuckEvents(stuckSince: Date): Promise<number> {
    await this.ensureIndexes();

    const result = await this.collection.updateMany(
      {
        processedAt: OutboxProcessedAt.processing().toValue(),
        updatedAt: { $lt: stuckSince },
      } as Filter<OutboxEventDTO>,
      {
        $set: {
          processedAt: OutboxProcessedAt.never().toValue(),
          updatedAt: new Date(),
        },
      },
    );

    return result.modifiedCount;
  }

  async deleteProcessed(before: Date, context?: RepositoryContext) {
    await this.ensureIndexes();
    this.registerTransactionParticipant(context);

    // Safe type assertion - we know OutboxEventDTO structure and MongoDB query operators
    // Exclude NEVER_PROCESSED (0) and PROCESSING (1) markers
    const filter: Filter<OutboxEventDTO> = {
      processedAt: {
        $lt: before,
        $gt: OutboxProcessedAt.processing().toValue(), // Only delete actually processed events
      },
    } as Filter<OutboxEventDTO>;

    await this.collection.deleteMany(filter, {
      session: this.getTransactionSession(context),
    });
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'ux_outbox_id',
        },
      },
      {
        fields: { processedAt: 1, createdAt: 1 },
        options: { name: 'idx_outbox_processedAt_createdAt' },
      },
    ];
  }
}
