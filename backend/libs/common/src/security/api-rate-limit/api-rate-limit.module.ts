import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitOptions } from './api-rate-limit.types';
import { rateLimitOptionsToThrottlerArray } from './api-rate-limit.utils';
import { ApiRateLimitGuard } from './api-rate-limit.guard';

export interface ApiRateLimitStorageOptions {
  /** Modules that provide and export the storage class. */
  imports?: DynamicModule['imports'];
  /** A ThrottlerStorage implementation, e.g. ThrottlerStorageRedis. */
  storageClass: Type<ThrottlerStorage>;
}

/**
 * API Rate Limiting Module
 *
 * Provides flexible time-based rate limiting for APIs with support for
 * different rate limit types: 'ip', 'user', and 'global'.
 *
 * - 'ip': Rate limits based on client IP address (default)
 * - 'user': Rate limits based on authenticated user ID (falls back to IP if not authenticated)
 * - 'global': Shared rate limit across all requests
 *
 * The default storage is in-process memory, which is fine for a single
 * instance. When running multiple instances, pass a shared storage (e.g.
 * ThrottlerStorageRedis from @libs/nestjs-redis) so limits apply globally.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     ApiRateLimitModule.forRoot(
 *       {
 *         '1minute': { type: 'ip', limit: 100 },
 *         '1hour': { type: 'user', limit: 1000 },
 *       },
 *       {
 *         imports: [RedisThrottlerStorageModule],
 *         storageClass: ThrottlerStorageRedis,
 *       },
 *     ),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class ApiRateLimitModule {
  static forRoot(options: RateLimitOptions, storage?: ApiRateLimitStorageOptions): DynamicModule {
    const throttlerConfigs = rateLimitOptionsToThrottlerArray(options);

    const throttlerModule = storage
      ? ThrottlerModule.forRootAsync({
          imports: storage.imports ?? [],
          useFactory: (storageInstance: ThrottlerStorage) => ({
            throttlers: throttlerConfigs,
            storage: storageInstance,
          }),
          inject: [storage.storageClass],
        })
      : ThrottlerModule.forRoot(throttlerConfigs);

    return {
      module: ApiRateLimitModule,
      imports: [throttlerModule],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ApiRateLimitGuard,
        },
      ],
      exports: [ThrottlerModule],
    };
  }
}
