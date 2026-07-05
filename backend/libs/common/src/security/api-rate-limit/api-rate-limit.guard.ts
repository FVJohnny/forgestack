import { Injectable, ExecutionContext, Inject, Optional } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_TYPE_KEY } from './api-rate-limit.decorator';
import type { RateLimitType } from './api-rate-limit.types';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.types';
import { JwtTokenService } from '../../auth/jwt-token.service';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth-cookies';

@Injectable()
export class ApiRateLimitGuard extends ThrottlerGuard {
  constructor(
    @Inject(THROTTLER_OPTIONS) options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @Optional() private readonly jwtTokenService?: JwtTokenService,
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
        // This guard is registered as APP_GUARD, so it runs before route
        // guards populate request.tokenData; extract the user from the token
        // directly (cookie first, then bearer header) and fall back to IP when
        // unauthenticated.
        const userId = request.tokenData?.userId ?? this.extractUserIdFromToken(request);
        if (!userId) {
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

  private extractUserIdFromToken(request: Partial<AuthenticatedRequest>): string | undefined {
    if (!this.jwtTokenService) return undefined;

    // Browsers send the access token in an httpOnly cookie (JwtAuthGuard reads
    // it cookie-first); Swagger and service-to-service callers use the bearer
    // header. Mirror that order here or every browser 'user' limit silently
    // keys by IP.
    const token = this.extractToken(request);
    if (!token) return undefined;

    try {
      return this.jwtTokenService.verifyAccessToken(token).userId;
    } catch {
      return undefined;
    }
  }

  private extractToken(request: Partial<AuthenticatedRequest>): string | undefined {
    const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (cookieToken) return cookieToken;

    const [scheme, token] = request.headers?.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }
}
