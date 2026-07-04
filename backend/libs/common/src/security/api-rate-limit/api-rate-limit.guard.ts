import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_TYPE_KEY } from './api-rate-limit.decorator';
import type { RateLimitType } from './api-rate-limit.types';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.types';

@Injectable()
export class ApiRateLimitGuard extends ThrottlerGuard {
  constructor(
    @Inject(THROTTLER_OPTIONS) options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected generateKey(context: ExecutionContext, suffix: string, throttlerName: string): string {
    const rateLimitTypes = this.reflector.getAllAndOverride<Record<string, RateLimitType>>(
      RATE_LIMIT_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const type: RateLimitType = rateLimitTypes?.[throttlerName] || 'ip';
    const request = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();

    let key: string;

    switch (type) {
      case 'user': {
        const userId = request.tokenData?.userId;
        if (!userId) {
          // Fall back to IP if no user is authenticated
          key = suffix;
        } else {
          key = `user:${userId}`;
        }
        break;
      }

      case 'global':
        key = 'global';
        break;

      case 'ip':
      default:
        key = suffix;
        break;
    }

    return `${context.getClass().name}-${context.getHandler().name}-${throttlerName}-${key}`;
  }
}
