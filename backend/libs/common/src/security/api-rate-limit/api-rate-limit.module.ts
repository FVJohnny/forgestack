import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitOptions } from './api-rate-limit.types';
import { rateLimitOptionsToThrottlerArray } from './api-rate-limit.utils';
import { ApiRateLimitGuard } from './api-rate-limit.guard';

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
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     ApiRateLimitModule.forRoot({
 *       '1minute': { type: 'ip', limit: 100 },
 *       '1hour': { type: 'user', limit: 1000 }
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class ApiRateLimitModule {
  static forRoot(options: RateLimitOptions) {
    const throttlerConfigs = rateLimitOptionsToThrottlerArray(options);

    return {
      module: ApiRateLimitModule,
      imports: [ThrottlerModule.forRoot(throttlerConfigs)],
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
