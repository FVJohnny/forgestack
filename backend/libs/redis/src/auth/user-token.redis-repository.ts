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

    // Add token to user's token set
    const userTokensKey = this.getUserTokensKey(token.userId.toValue());
    await client.sadd(userTokensKey, token.id.toValue());

    // Create token lookup index for O(1) lookups by token value
    const tokenLookupKey = this.getTokenLookupKey(token.token.toValue());
    await client.set(tokenLookupKey, token.id.toValue());

    await super.save(token, context);

    // this.logger.debug(`Stored ${token.type.toValue()} token for user ${token.userId.toValue()}`);
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

      // Delete all tokens and their lookup indexes
      for (const tokenId of tokenIds) {
        // Get the token to find its token value for the lookup index
        const userToken = await this.findById(new Id(tokenId));
        if (userToken) {
          // Delete the token lookup index
          const tokenLookupKey = this.getTokenLookupKey(userToken.token.toValue());
          await client.del(tokenLookupKey);
        }
        await client.del(this.itemKey(tokenId));
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
