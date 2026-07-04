import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type IQueryBus } from '@nestjs/cqrs';

import { ACCESS_TOKEN_COOKIE } from './auth-cookies';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Item 62: the JWT guard is security-critical and had no tests. These cover
 * token extraction (cookie-first, Bearer fallback), the verify + repository
 * check, and that every failure path throws Unauthorized.
 */
describe('JwtAuthGuard', () => {
  const makeContext = (req: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as ExecutionContext;

  const setup = (opts: {
    verify?: jest.Mock;
    query?: jest.Mock;
  } = {}) => {
    const jwtService = {
      verifyAsync: opts.verify ?? jest.fn().mockResolvedValue({ sub: 'u1', email: 'a@b.c' }),
    } as unknown as JwtService;
    const queryBus = {
      execute: opts.query ?? jest.fn().mockResolvedValue({}),
    } as unknown as IQueryBus;
    return { guard: new JwtAuthGuard(jwtService, queryBus), jwtService, queryBus };
  };

  it('throws Unauthorized when no token is present', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(makeContext({ headers: {}, cookies: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a valid httpOnly cookie token and attaches the payload', async () => {
    const { guard } = setup();
    const req: Record<string, unknown> = {
      headers: {},
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-jwt' },
    };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(req.tokenData).toEqual({ sub: 'u1', email: 'a@b.c' });
  });

  it('falls back to the Bearer header when no cookie is present', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u2' });
    const { guard } = setup({ verify });
    const req = { headers: { authorization: 'Bearer header-jwt' }, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('header-jwt');
  });

  it('prefers the cookie over the Authorization header', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u3' });
    const { guard } = setup({ verify });
    const req = {
      headers: { authorization: 'Bearer header-jwt' },
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-jwt' },
    };
    await guard.canActivate(makeContext(req));
    expect(verify).toHaveBeenCalledWith('cookie-jwt');
  });

  it('ignores a non-Bearer Authorization scheme', async () => {
    const { guard } = setup();
    const req = { headers: { authorization: 'Basic abc' }, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws Unauthorized when JWT verification fails', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('bad signature'));
    const { guard } = setup({ verify });
    const req = { headers: {}, cookies: { [ACCESS_TOKEN_COOKIE]: 'bad' } };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws Unauthorized when the token is not found in the repository', async () => {
    // JWT verifies, but the repository lookup (revocation check) rejects.
    const query = jest.fn().mockRejectedValue(new Error('token not found'));
    const { guard } = setup({ query });
    const req = { headers: {}, cookies: { [ACCESS_TOKEN_COOKIE]: 'revoked' } };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
