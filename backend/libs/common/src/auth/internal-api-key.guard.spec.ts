import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { InternalApiKeyGuard } from './internal-api-key.guard';

/**
 * Item 62: the internal-API-key guard gates Prometheus/service-to-service
 * traffic and had no tests. The guard reads INTERNAL_API_KEY at construction,
 * so each case builds the guard after setting the env.
 */
describe('InternalApiKeyGuard', () => {
  const OLD_ENV = process.env.INTERNAL_API_KEY;

  const makeContext = (headers: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as ExecutionContext;

  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = OLD_ENV;
  });

  const guardWithKey = (key: string | undefined) => {
    if (key === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = key;
    return new InternalApiKeyGuard();
  };

  it('throws when INTERNAL_API_KEY is not configured', () => {
    const guard = guardWithKey(undefined);
    expect(() => guard.canActivate(makeContext({ 'x-internal-api-key': 'anything' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a matching X-Internal-Api-Key header', () => {
    const guard = guardWithKey('secret-key');
    expect(guard.canActivate(makeContext({ 'x-internal-api-key': 'secret-key' }))).toBe(true);
  });

  it('accepts a matching Authorization: ApiKey header (Prometheus form)', () => {
    const guard = guardWithKey('secret-key');
    expect(guard.canActivate(makeContext({ authorization: 'ApiKey secret-key' }))).toBe(true);
  });

  it('rejects a wrong key', () => {
    const guard = guardWithKey('secret-key');
    expect(() => guard.canActivate(makeContext({ 'x-internal-api-key': 'wrong' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing key', () => {
    const guard = guardWithKey('secret-key');
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('ignores a non-ApiKey Authorization scheme', () => {
    const guard = guardWithKey('secret-key');
    expect(() => guard.canActivate(makeContext({ authorization: 'Bearer secret-key' }))).toThrow(
      UnauthorizedException,
    );
  });
});
