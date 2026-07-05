import { Injectable } from '@nestjs/common';
import type { ChainableCommander } from 'ioredis';

import {
  OutboxEvent,
  OutboxProcessedAt,
  Outbox_Repository,
  type RepositoryContext,
  type Id,
} from '@libs/nestjs-common';

import { Base_RedisRepository } from '../infrastructure/base.redis-repository';
import type { RedisService } from '../redis.service';

/**
 * Opt-in alternative to Outbox_MongodbRepository. No shipped service wires this
 * in: both example services and the generated service use the Mongo outbox.
 * It lives here as a swap-in for teams that want to keep the outbox in Redis.
 * To use it, provide it for OUTBOX_REPOSITORY in your app.module in place of
 * Outbox_MongodbRepository.
 *
 * The claim and reclaim paths are atomic via Lua. The `save` index maintenance
 * runs the secondary-index updates in a single pipeline; the item write still
 * happens first (in super.save), so under a hard crash between the two the
 * indexes self-heal on the next save or reclaim. That is acceptable for the
 * demo but worth hardening (item write plus index in one MULTI/Lua) before
 * relying on it in production.
 */
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

    const v = event.toValue();

    // Maintain the secondary indexes in a single pipeline so a state transition
    // does not leave the item present in one index and missing from another
    // between round-trips. Under a transaction context, queue the index updates
    // onto the shared transaction pipeline (the parent commits it); otherwise
    // run them in a fresh pipeline here.
    const transactional = this.isTransactional(context);
    const pipeline = transactional
      ? (this.getClient(context) as ChainableCommander)
      : this.getRedisClient().pipeline();

    if (event.isUnprocessed()) {
      pipeline.zadd(this.zUnprocessed, Date.parse(String(v.createdAt)), v.id);
      pipeline.zrem(this.zProcessed, v.id);
      pipeline.zrem(this.zClaimed, v.id);
    } else if (event.isProcessed()) {
      pipeline.zrem(this.zUnprocessed, v.id);
      pipeline.zrem(this.zClaimed, v.id);
      pipeline.zadd(this.zProcessed, Date.parse(String(v.processedAt)), v.id);
    } else if (event.isFailed()) {
      // Dead-lettered: pull it out of every active index so it is never
      // re-claimed. The item itself is kept for inspection.
      pipeline.zrem(this.zUnprocessed, v.id);
      pipeline.zrem(this.zClaimed, v.id);
      pipeline.zrem(this.zProcessed, v.id);
    }

    if (!transactional) {
      await (pipeline as ChainableCommander).exec();
    }
  }

  async countUnprocessed(): Promise<number> {
    // O(1) from the secondary index maintained on save.
    return this.getRedisClient().zcard(this.zUnprocessed);
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
  // Atomically reclaims one stuck event: if it is still PROCESSING, reset it to
  // never-processed and move it from the claimed index back to unprocessed; in
  // all cases remove it from the claimed index. Doing the read-modify-write in
  // a single Lua call (like the claim path) avoids the race where a concurrent
  // completion or reset interleaves with the reclaim.
  // KEYS[1]=zClaimed, KEYS[2]=zUnprocessed; ARGV[1]=item key, ARGV[2]=id,
  // ARGV[3]=never marker, ARGV[4]=processing marker, ARGV[5]=createdAt score.
  // Returns 1 if reclaimed, 0 otherwise.
  private static readonly RECLAIM_EVENT_LUA = `
    local json = redis.call('GET', ARGV[1])
    if not json then
      redis.call('ZREM', KEYS[1], ARGV[2])
      return 0
    end
    local event = cjson.decode(json)
    if event['processedAt'] ~= ARGV[4] then
      redis.call('ZREM', KEYS[1], ARGV[2])
      return 0
    end
    event['processedAt'] = ARGV[3]
    redis.call('SET', ARGV[1], cjson.encode(event))
    redis.call('ZADD', KEYS[2], ARGV[5], ARGV[2])
    redis.call('ZREM', KEYS[1], ARGV[2])
    return 1
  `;

  async reclaimStuckEvents(stuckSince: Date): Promise<number> {
    const client = this.getRedisClient();

    // Find events claimed before the threshold
    const ids = await client.zrangebyscore(this.zClaimed, '-inf', stuckSince.getTime());
    if (ids.length === 0) return 0;

    const neverMarker = OutboxProcessedAt.NEVER_PROCESSED.toISOString();
    const processingMarker = OutboxProcessedAt.PROCESSING.toISOString();

    let reclaimed = 0;
    for (const id of ids) {
      const key = this.itemKey(id);
      const json = await client.get(key);
      const createdAtScore = json ? this.toEntity(json).timestamps.createdAt.getTime() : Date.now();

      const result = (await client.eval(
        Outbox_RedisRepository.RECLAIM_EVENT_LUA,
        2,
        this.zClaimed,
        this.zUnprocessed,
        key,
        id,
        neverMarker,
        processingMarker,
        createdAtScore.toString(),
      )) as number;

      if (result === 1) reclaimed++;
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
    event.markAsUnprocessed();

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
