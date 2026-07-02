import type { Repository, RepositoryContext, Id } from '../../..';
import type { UserToken } from '../entities/user-token.aggregate';
import type { Token } from '../entities/token.vo';

export const USER_TOKEN_REPOSITORY = Symbol('UserTokenRepository');

export interface UserToken_Repository extends Repository<UserToken, Id> {
  /**
   * Get all active tokens for a user
   */
  getUserTokens(userId: Id): Promise<UserToken[]>;

  /**
   * Find a token by its value
   */
  findByToken(token: Token): Promise<UserToken | null>;

  /**
   * Revoke all tokens for a specific user
   */
  revokeAllUserTokens(userId: Id, context?: RepositoryContext): Promise<void>;
}
