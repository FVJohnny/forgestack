import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { RateLimitOptions, RateLimitType } from './api-rate-limit.types';
import { rateLimitOptionsToThrottlerOptions } from './api-rate-limit.utils';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMIT_TYPE_KEY = 'rate_limit_type';

/**
 * Custom rate limit decorator that supports multiple time-based configurations
 * with different rate limit types (ip, user, global)
 *
 * @param options - Rate limit configuration with time keys and limits
 * @example
 * // Rate limit by IP address
 * @RateLimit({
 *   '1minute': { type: 'ip', limit: 10 },
 *   '1hour': { type: 'ip', limit: 100 }
 * })
 *
 * @example
 * // Rate limit by authenticated user
 * @RateLimit({
 *   '1minute': { type: 'user', limit: 10 },
 * })
 *
 * @example
 * // Global rate limit (shared across all requests)
 * @RateLimit({
 *   '1minute': { type: 'global', limit: 1000 },
 * })
 */
export function RateLimit(options: RateLimitOptions) {
  const throttlerOptions = rateLimitOptionsToThrottlerOptions(options);

  // Extract type mapping for each time key
  const typeMapping: Record<string, RateLimitType> = {};
  Object.entries(options).forEach(([timeKey, config]) => {
    if (config?.type) {
      typeMapping[timeKey] = config.type;
    }
  });

  return applyDecorators(SetMetadata(RATE_LIMIT_TYPE_KEY, typeMapping), Throttle(throttlerOptions));
}
