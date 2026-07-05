import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

import { ACCESS_TOKEN_COOKIE } from '../../auth/auth-cookies';
import { JwtTokenService } from '../../auth/jwt-token.service';
import { ApiRateLimitGuard } from './api-rate-limit.guard';
import { RATE_LIMIT_TYPE_KEY } from './api-rate-limit.decorator';

/**
 * Item 122: after the cookie-auth migration (item 8) browsers send no
 * Authorization header, so a 'user' rate limit must extract the user id from
 * the access-token cookie or it silently keys by IP. These assert the key is
 * `user:<id>` when the token arrives by cookie (and by bearer), and falls back
 * to the IP suffix when neither is present.
 */
describe('ApiRateLimitGuard user keying', () => {
  const makeGuard = (verify?: jest.Mock) => {
    const jwt = { verifyAccessToken: verify } as unknown as JwtTokenService;
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ default: 'user' } as Record<string, string>);
    const guard = new ApiRateLimitGuard(
      {} as ThrottlerModuleOptions,
      {} as ThrottlerStorage,
      reflector,
      verify ? jwt : undefined,
    );
    return guard as unknown as {
      generateKey: (ctx: ExecutionContext, suffix: string, name: string) => string;
    };
  };

  const ctxFor = (req: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => function handler() {},
      getClass: () => class Klass {},
    }) as unknown as ExecutionContext;

  it('keys by user id extracted from the access-token cookie', () => {
    const verify = jest.fn().mockReturnValue({ userId: 'u-cookie' });
    const guard = makeGuard(verify);
    const key = guard.generateKey(
      ctxFor({ cookies: { [ACCESS_TOKEN_COOKIE]: 'tok' }, headers: {} }),
      'ip-suffix',
      'default',
    );
    expect(verify).toHaveBeenCalledWith('tok');
    expect(key).toContain('user:u-cookie');
  });

  it('keys by user id extracted from the bearer header', () => {
    const verify = jest.fn().mockReturnValue({ userId: 'u-bearer' });
    const guard = makeGuard(verify);
    const key = guard.generateKey(
      ctxFor({ cookies: {}, headers: { authorization: 'Bearer tok' } }),
      'ip-suffix',
      'default',
    );
    expect(key).toContain('user:u-bearer');
  });

  it('falls back to the IP suffix when there is no token', () => {
    const verify = jest.fn();
    const guard = makeGuard(verify);
    const key = guard.generateKey(ctxFor({ cookies: {}, headers: {} }), 'ip-suffix', 'default');
    expect(verify).not.toHaveBeenCalled();
    expect(key).toContain('ip-suffix');
    expect(key).not.toContain('user:');
  });
});
