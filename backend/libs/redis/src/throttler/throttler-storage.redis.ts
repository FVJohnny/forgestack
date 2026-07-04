import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../redis.service';

/**
 * Redis-backed storage for @nestjs/throttler so rate limits are shared
 * across horizontally scaled instances (the default storage is per-process
 * memory). One atomic Lua script per hit: increment, set the window TTL on
 * first hit, and set a block key when the limit is exceeded.
 */
@Injectable()
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private static readonly INCREMENT_SCRIPT = `
    local hitKey = KEYS[1]
    local blockKey = KEYS[2]
    local ttl = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockDuration = tonumber(ARGV[3])

    local blockTtl = redis.call('PTTL', blockKey)
    if blockTtl > 0 then
      local hits = tonumber(redis.call('GET', hitKey) or '0')
      local hitTtl = redis.call('PTTL', hitKey)
      if hitTtl < 0 then hitTtl = 0 end
      return {hits, hitTtl, 1, blockTtl}
    end

    local totalHits = redis.call('INCR', hitKey)
    local timeToExpire = redis.call('PTTL', hitKey)
    if timeToExpire < 0 then
      redis.call('PEXPIRE', hitKey, ttl)
      timeToExpire = ttl
    end

    if totalHits > limit then
      redis.call('SET', blockKey, '1', 'PX', blockDuration)
      return {totalHits, timeToExpire, 1, blockDuration}
    end

    return {totalHits, timeToExpire, 0, 0}
  `;

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getDatabaseClient();
    if (!client) {
      throw new Error('Redis client is not available for throttler storage');
    }

    const hitKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:blocked`;

    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = (await client.eval(
      ThrottlerStorageRedis.INCREMENT_SCRIPT,
      2,
      hitKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    // The in-memory ThrottlerStorageService reports expirations in seconds.
    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
    };
  }
}
