import { Injectable } from '@nestjs/common';
import { Base_RedisRepository } from '../infrastructure/base.redis-repository';
import { RedisService } from '../redis.service';
import type { RepositoryContext } from '@libs/nestjs-common';
import { Id, type UserToken_Repository, UserToken, Token } from '@libs/nestjs-common';

@Injectable()
export class UserToken_RedisRepository
  extends Base_RedisRepository<UserToken>
  implements UserToken_Repository
{
  private readonly keyPrefix = 'auth:token:';
  private readonly userTokensPrefix = 'auth:user-tokens:';
  private readonly tokenLookupPrefix = 'auth:token-lookup:';

  constructor(redisService: RedisService) {
    super(redisService);
  }

  protected itemKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  private getUserTokensKey(userId: string): string {
    return `${this.userTokensPrefix}${userId}`;
  }

  private getTokenLookupKey(token: string): string {
    return `${this.tokenLookupPrefix}${token}`;
  }

  protected toEntity(json: string): UserToken {
    return UserToken.fromValue(JSON.parse(json));
  }

  async findByToken(token: Token) {
    const client = this.getRedisClient();
    const lookupKey = this.getTokenLookupKey(token.toValue());
    const tokenId = await client.get(lookupKey);

    if (!tokenId) {
      return null;
    }

    return this.findById(new Id(tokenId));
  }

  async save(token: UserToken, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);

    // Expire the stored token when the JWT itself expires, so revoked/expired
    // tokens do not accumulate in Redis forever. A small grace period keeps
    // the record around slightly past `exp` to cover clock skew. If the token
    // carries no usable `exp`, fall back to a bounded default rather than
    // persisting forever.
    const ttlSeconds = this.resolveTtlSeconds(token.token.toValue());

    // Add token to user's token set
    const userTokensKey = this.getUserTokensKey(token.userId.toValue());
    await client.sadd(userTokensKey, token.id.toValue());
    await client.expire(userTokensKey, ttlSeconds);

    // Create token lookup index for O(1) lookups by token value
    const tokenLookupKey = this.getTokenLookupKey(token.token.toValue());
    await client.set(tokenLookupKey, token.id.toValue(), 'EX', ttlSeconds);

    await super.save(token, context);
    await client.expire(this.itemKey(token.id.toValue()), ttlSeconds);
  }

  private static readonly TTL_GRACE_SECONDS = 60;
  private static readonly TTL_FALLBACK_SECONDS = 7 * 24 * 60 * 60; // 7 days

  /**
   * Derives the Redis TTL from the JWT's `exp` claim (seconds since epoch)
   * plus a small grace window. Decoding without verifying is fine here: we
   * only read the expiry to bound the key's lifetime, not to trust the token.
   */
  private resolveTtlSeconds(jwt: string): number {
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      const [, payloadB64] = jwt.split('.');
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
        if (typeof payload.exp === 'number') {
          const remaining = payload.exp - nowSeconds + UserToken_RedisRepository.TTL_GRACE_SECONDS;
          if (remaining > 0) {
            return remaining;
          }
        }
      }
    } catch {
      // Malformed token: fall through to the bounded default.
    }
    return UserToken_RedisRepository.TTL_FALLBACK_SECONDS;
  }

  async clear(context?: RepositoryContext): Promise<void> {
    await super.clear(context);
    // Also drop the secondary indexes kept next to the items.
    await this.deleteByPattern(`${this.tokenLookupPrefix}*`, context);
    await this.deleteByPattern(`${this.userTokensPrefix}*`, context);
  }

  async remove(id: Id, context?: RepositoryContext): Promise<void> {
    // Clean up the secondary indexes (token lookup + user token set) so a
    // removed token cannot be resolved through findByToken/getUserTokens.
    const userToken = await this.findById(id);
    if (userToken) {
      this.registerTransactionParticipant(context);
      const client = this.getClient(context);
      await client.del(this.getTokenLookupKey(userToken.token.toValue()));
      await client.srem(this.getUserTokensKey(userToken.userId.toValue()), id.toValue());
    }

    await super.remove(id, context);
  }

  async getUserTokens(userId: Id): Promise<UserToken[]> {
    const userTokensKey = this.getUserTokensKey(userId.toValue());

    try {
      const tokenIds = await this.getRedisClient().smembers(userTokensKey);
      const tokens: UserToken[] = [];

      for (const tokenId of tokenIds) {
        const token = await this.findById(new Id(tokenId));
        if (token) {
          tokens.push(token);
        }
      }

      return tokens;
    } catch (error) {
      this.logger.error(`Failed to get user tokens: ${error}`);
      return [];
    }
  }

  async revokeAllUserTokens(userId: Id, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);

    const userTokensKey = this.getUserTokensKey(userId.toValue());

    try {
      // Get all token IDs for this user
      const tokenIds = await this.getRedisClient().smembers(userTokensKey);

      if (tokenIds.length === 0) {
        this.logger.debug(`No tokens found for user ${userId}`);
        return;
      }

      // remove() already deletes the item plus both secondary indexes (the
      // token lookup key and the user-token-set membership), so let it do the
      // cleanup for each token instead of duplicating the deletes here.
      for (const tokenId of tokenIds) {
        await this.remove(new Id(tokenId), context);
      }
      await client.del(userTokensKey);

      this.logger.debug(`Revoked ${tokenIds.length} tokens for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke user tokens: ${error}`);
      throw error;
    }
  }
}
