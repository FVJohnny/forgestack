import { Module } from '@nestjs/common';
import { ThrottlerStorageRedis } from './throttler-storage.redis';

/**
 * Provides the Redis-backed throttler storage. Import it (together with the
 * global RedisDBModule) and pass it to ApiRateLimitModule.forRoot:
 *
 * ```typescript
 * ApiRateLimitModule.forRoot(options, {
 *   imports: [RedisThrottlerStorageModule],
 *   storageClass: ThrottlerStorageRedis,
 * })
 * ```
 */
@Module({
  providers: [ThrottlerStorageRedis],
  exports: [ThrottlerStorageRedis],
})
export class RedisThrottlerStorageModule {}
