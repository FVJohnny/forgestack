import { Injectable, Inject } from '@nestjs/common';
import type { MongoClient, Filter } from 'mongodb';

import {
  InboxEvent,
  InboxStatus,
  InboxStatusVO,
  type InboxEventDTO,
  type InboxRepository,
  type RepositoryContext,
  type DateVO,
} from '@libs/nestjs-common';
import { Base_MongoRepository, IndexSpec } from '../infrastructure/base.mongo-repository';
import { MONGO_CLIENT_TOKEN } from '../mongodb.module';

@Injectable()
export class Inbox_MongodbRepository
  extends Base_MongoRepository<InboxEvent, InboxEventDTO>
  implements InboxRepository
{
  static CollectionName = 'inbox_events';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, Inbox_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: InboxEventDTO): InboxEvent {
    return InboxEvent.fromValue(dto);
  }

  async findPendingEvents(limit = 100): Promise<InboxEvent[]> {
    await this.ensureIndexes();

    const filter: Filter<InboxEventDTO> = {
      status: InboxStatus.PENDING,
    } as Filter<InboxEventDTO>;

    const cursor = this.collection.find(filter).sort({ receivedAt: 1 }).limit(limit);

    const docs = await cursor.toArray();
    return docs.map((d) => InboxEvent.fromValue(d as InboxEventDTO));
  }

  /**
   * Atomically claims pending events using findOneAndUpdate.
   * Each event is claimed individually to ensure no race conditions.
   * Uses MongoDB's atomic findOneAndUpdate to guarantee that only one consumer
   * can claim each event, even under concurrent access.
   */
  async claimPendingEvents(limit = 100): Promise<InboxEvent[]> {
    await this.ensureIndexes();

    const claimedEvents: InboxEvent[] = [];

    // Use findOneAndUpdate in a loop for atomic claiming
    // This ensures no race conditions - each event can only be claimed once
    for (let i = 0; i < limit; i++) {
      const doc = await this.collection.findOneAndUpdate(
        { status: InboxStatus.PENDING } as Filter<InboxEventDTO>,
        { $set: { status: InboxStatus.PROCESSING } },
        {
          sort: { receivedAt: 1 },
          returnDocument: 'after',
        },
      );

      if (!doc) {
        // No more pending events
        break;
      }

      claimedEvents.push(InboxEvent.fromValue(doc as InboxEventDTO));
    }

    return claimedEvents;
  }

  async findByStatus(status: InboxStatusVO, limit = 100): Promise<InboxEvent[]> {
    await this.ensureIndexes();

    const filter: Filter<InboxEventDTO> = {
      status: status.toValue(),
    } as Filter<InboxEventDTO>;

    const cursor = this.collection.find(filter).sort({ receivedAt: 1 }).limit(limit);

    const docs = await cursor.toArray();
    return docs.map((d) => InboxEvent.fromValue(d as InboxEventDTO));
  }

  async deleteProcessed(olderThan: DateVO, context?: RepositoryContext): Promise<void> {
    await this.ensureIndexes();
    this.registerTransactionParticipant(context);

    const filter: Filter<InboxEventDTO> = {
      status: InboxStatus.PROCESSED,
      processedAt: { $lt: olderThan.toValue() },
    } as Filter<InboxEventDTO>;

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
          name: 'ux_inbox_id',
        },
      },
      {
        // Compound index for efficient claiming: status + receivedAt ordering
        fields: { status: 1, receivedAt: 1 },
        options: { name: 'idx_inbox_status_receivedAt' },
      },
      {
        // Index for cleanup of processed events
        fields: { status: 1, processedAt: 1 },
        options: { name: 'idx_inbox_status_processedAt' },
      },
    ];
  }
}
