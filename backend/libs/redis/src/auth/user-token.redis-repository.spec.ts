import { Id, Token, UserToken } from '@libs/nestjs-common';
import { RedisTestService } from '../testing/redis-test.service';
import { UserToken_RedisRepository } from './user-token.redis-repository';

// Builds a minimal JWT (header.payload.signature) with the given exp claim.
function makeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user', exp: expSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}

describe('UserToken_RedisRepository TTL', () => {
  const redisTestService = new RedisTestService();
  let repository: UserToken_RedisRepository;

  beforeAll(async () => {
    await redisTestService.setupDatabase();
    repository = new UserToken_RedisRepository(redisTestService);
  });

  afterEach(async () => {
    await redisTestService.clear();
  });

  afterAll(async () => {
    await redisTestService.closeDatabase();
  });

  const client = () => redisTestService.getDatabaseClient()!;

  const saveToken = async (jwt: string) => {
    const userId = Id.random();
    const token = UserToken.create({ userId, token: new Token(jwt), type: 'access' });
    await repository.save(token);
    return { userId, token };
  };

  it('sets a TTL on the item, lookup, and user-set keys derived from the JWT exp', async () => {
    const exp = Math.floor(Date.now() / 1000) + 900; // 15 minutes out
    const { userId, token } = await saveToken(makeJwt(exp));

    const itemTtl = await client().ttl(`auth:token:${token.id.toValue()}`);
    const lookupTtl = await client().ttl(`auth:token-lookup:${token.token.toValue()}`);
    const setTtl = await client().ttl(`auth:user-tokens:${userId.toValue()}`);

    // ~900s + 60s grace, allow a little slack for execution time.
    for (const ttl of [itemTtl, lookupTtl, setTtl]) {
      expect(ttl).toBeGreaterThan(900);
      expect(ttl).toBeLessThanOrEqual(960 + 5);
    }
  });

  it('falls back to a bounded TTL when the token has no usable exp', async () => {
    const { token } = await saveToken('not-a-jwt');

    const itemTtl = await client().ttl(`auth:token:${token.id.toValue()}`);
    // 7-day fallback; just assert it is bounded and positive.
    expect(itemTtl).toBeGreaterThan(0);
    expect(itemTtl).toBeLessThanOrEqual(7 * 24 * 60 * 60);
  });

  it('still resolves the token by value before it expires', async () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    const { token } = await saveToken(makeJwt(exp));

    const found = await repository.findByToken(token.token);
    expect(found).not.toBeNull();
    expect(found?.id.toValue()).toBe(token.id.toValue());
  });
});
