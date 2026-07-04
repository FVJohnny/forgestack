import { Injectable } from '@nestjs/common';

import {
  OutboxEvent,
  OutboxProcessedAt,
  Outbox_Repository,
  type RepositoryContext,
  type Id,
} from '@libs/nestjs-common';

import { Base_RedisRepository } from '../infrastructure/base.redis-repository';
import type { RedisService } from '../redis.service';

@Injectable()
export class Outbox_RedisRepository
  extends Base_RedisRepository<OutboxEvent>
  implements Outbox_Repository
{
  private readonly keyPrefix = 'outbox:';
  private readonly zUnprocessed = `${this.keyPrefix}unprocessedByCreatedAt`;
  private readonly zProcessed = `${this.keyPrefix}processedByProcessedAt`;
  private readonly zClaimed = `${this.keyPrefix}claimedByClaimedAt`;

  constructor(redisService: RedisService) {
    super(redisService);
  }

  protected itemKey(id: string): string {
    return `${this.keyPrefix}event:${id}`;
  }

  protected toEntity(json: string): OutboxEvent {
    return OutboxEvent.fromValue(JSON.parse(json));
  }

  async save(event: OutboxEvent, context?: RepositoryContext): Promise<void> {
    await super.save(event, context);

    const client = this.getClient(context);
    const v = event.toValue();

    // Maintain secondary indexes
    if (event.isUnprocessed()) {
      await client.zadd(this.zUnprocessed, Date.parse(String(v.createdAt)), v.id);
      await client.zrem(this.zProcessed, v.id);
      await client.zrem(this.zClaimed, v.id);
    } else if (event.isProcessed()) {
      await client.zrem(this.zUnprocessed, v.id);
      await client.zrem(this.zClaimed, v.id);
      await client.zadd(this.zProcessed, Date.parse(String(v.processedAt)), v.id);
    }
  }

  async findUnprocessed(limit = 100) {
    const client = this.getRedisClient();

    // Use zrange with ascending order to get oldest events first
    // (events with lowest createdAt timestamp scores)
    const ids = await client.zrange(this.zUnprocessed, 0, limit - 1);
    if (ids.length === 0) return [];

    const keys = ids.map((id) => this.itemKey(id));
    const jsons = await client.mget(keys);

    // Results are already sorted by createdAt (ascending) from zrange
    return jsons
      .filter((json) => !!json)
      .map((json) => this.toEntity(json || ''))
      .filter((v) => v !== null);
  }

  // Lua script that atomically claims a single unprocessed outbox event.
  // KEYS[1] = zUnprocessed sorted set, KEYS[2] = zClaimed sorted set
  // ARGV[1] = item key prefix, ARGV[2] = processing marker timestamp, ARGV[3] = current timestamp (ms)
  // Returns the event JSON string if claimed, or nil if no events available.
  private static readonly CLAIM_EVENT_LUA = `
    local ids = redis.call('ZRANGE', KEYS[1], 0, 0)
    if #ids == 0 then return nil end

    local id = ids[1]
    local key = ARGV[1] .. id
    local json = redis.call('GET', key)

    if not json then
      redis.call('ZREM', KEYS[1], id)
      return nil
    end

    local event = cjson.decode(json)
    event['processedAt'] = ARGV[2]
    local updated = cjson.encode(event)

    redis.call('SET', key, updated)
    redis.call('ZREM', KEYS[1], id)
    redis.call('ZADD', KEYS[2], ARGV[3], id)

    return updated
  `;

  /**
   * Atomically claims unprocessed events using a Lua script.
   * Each claim is a single atomic Redis operation, preventing race conditions
   * when multiple service instances compete for the same events.
   */
  async claimUnprocessedEvents(limit = 10): Promise<OutboxEvent[]> {
    const client = this.getRedisClient();
    const claimed: OutboxEvent[] = [];
    const processingTimestamp = OutboxProcessedAt.PROCESSING.toISOString();

    for (let i = 0; i < limit; i++) {
      const result = await client.eval(
        Outbox_RedisRepository.CLAIM_EVENT_LUA,
        2,
        this.zUnprocessed,
        this.zClaimed,
        `${this.keyPrefix}event:`,
        processingTimestamp,
        Date.now().toString(),
      );

      if (!result) break;

      claimed.push(this.toEntity(result as string));
    }

    return claimed;
  }

  /**
   * Reclaims events stuck in "processing" state since before the given date.
   * Resets them to unprocessed so they can be picked up again.
   */
  async reclaimStuckEvents(stuckSince: Date): Promise<number> {
    const client = this.getRedisClient();

    // Find events claimed before the threshold
    const ids = await client.zrangebyscore(this.zClaimed, '-inf', stuckSince.getTime());
    if (ids.length === 0) return 0;

    let reclaimed = 0;
    for (const id of ids) {
      const key = this.itemKey(id);
      const json = await client.get(key);
      if (!json) {
        await client.zrem(this.zClaimed, id);
        continue;
      }

      const event = this.toEntity(json);
      // Only reclaim if still in processing state (not already completed)
      if (event.processedAt.isProcessing()) {
        event.processedAt = OutboxProcessedAt.never();
        await client.set(key, JSON.stringify(event.toValue()));
        await client.zadd(this.zUnprocessed, event.timestamps.createdAt.getTime(), id);
        reclaimed++;
      }
      await client.zrem(this.zClaimed, id);
    }

    return reclaimed;
  }

  /**
   * Resets a claimed event back to unprocessed state.
   */
  async resetClaimedEvent(eventId: Id): Promise<void> {
    const client = this.getRedisClient();
    const key = this.itemKey(eventId.toValue());

    const json = await client.get(key);
    if (!json) return;

    const event = this.toEntity(json);
    event.processedAt = OutboxProcessedAt.never();

    // Save and add back to unprocessed index
    await client.set(key, JSON.stringify(event.toValue()));
    await client.zadd(this.zUnprocessed, event.timestamps.createdAt.getTime(), eventId.toValue());
    await client.zrem(this.zClaimed, eventId.toValue());
  }

  async deleteProcessed(olderThan: Date, context?: RepositoryContext) {
    this.registerTransactionParticipant(context);
    const client = this.getRedisClient();
    const transactionalClient = this.getTransactionClient(context) ?? client.pipeline();

    const ids = await client.zrangebyscore(this.zProcessed, '-inf', olderThan.getTime());
    if (ids.length === 0) return;

    ids.forEach((id) => {
      transactionalClient.del(this.itemKey(id));
      transactionalClient.zrem(this.zProcessed, id);
      transactionalClient.zrem(this.zUnprocessed, id);
    });

    // If this is not executed under a "parent" transaction
    // Execute the pipeline. If it is, we don't want to execute it now.
    // The "parent" transaction will execute it.
    if (!this.isTransactional(context)) {
      await transactionalClient.exec();
    }
  }

  async clear(context?: RepositoryContext): Promise<void> {
    await super.clear(context);

    const client = this.getClient(context);
    await client.del(this.zUnprocessed, this.zProcessed, this.zClaimed);
  }
}
