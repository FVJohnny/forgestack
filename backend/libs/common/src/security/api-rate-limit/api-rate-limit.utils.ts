import type { ThrottlerOptions } from '@nestjs/throttler';
import type { RateLimitOptions } from './api-rate-limit.types';
import { TIME_KEY_TO_TTL } from './api-rate-limit.types';

/**
 * Converts RateLimitOptions to ThrottlerOptions format
 * This is used by both the decorator and the module to ensure consistent transformation
 */
export function rateLimitOptionsToThrottlerOptions(
  options: RateLimitOptions,
): Record<string, ThrottlerOptions> {
  const throttlerOptions: Record<string, ThrottlerOptions> = {};

  Object.entries(options).forEach(([timeKey, config]) => {
    throttlerOptions[timeKey] = {
      ttl: TIME_KEY_TO_TTL[timeKey as keyof typeof TIME_KEY_TO_TTL],
      limit: config.limit,
    };
  });

  return throttlerOptions;
}

/**
 * Converts RateLimitOptions to an array of ThrottlerOptions
 * Used by the module for global configuration
 */
export function rateLimitOptionsToThrottlerArray(options: RateLimitOptions): ThrottlerOptions[] {
  const throttlerConfigs: ThrottlerOptions[] = [];

  Object.entries(options).forEach(([timeKey, config]) => {
    const ttl = TIME_KEY_TO_TTL[timeKey as keyof typeof TIME_KEY_TO_TTL];
    if (ttl && config) {
      throttlerConfigs.push({
        name: timeKey,
        ttl,
        limit: config.limit,
      });
    }
  });

  return throttlerConfigs;
}
