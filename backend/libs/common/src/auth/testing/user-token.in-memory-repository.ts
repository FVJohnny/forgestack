import type { RepositoryContext } from '../../transactions';
import type { Id } from '../../general/domain/value-objects/id.vo';
import { Base_InMemoryRepository } from '../../general/infrastructure/base.in-memory-repository';
import type { UserToken_Repository } from '../domain/repositories/user-token.repository';
import { UserToken } from '../domain/entities/user-token.aggregate';
import type { UserTokenDTO } from '../domain/entities/user-token.dto';
import type { Token } from '../domain/entities/token.vo';
import {
  Criteria,
  Filter,
  FilterField,
  FilterOperator,
  Filters,
  FilterValue,
  Operator,
} from '../../general/domain';

export class UserToken_InMemoryRepository
  extends Base_InMemoryRepository<UserToken, UserTokenDTO>
  implements UserToken_Repository
{
  constructor(shouldFail: boolean = false) {
    super(shouldFail);
  }

  protected toEntity(dto: UserTokenDTO): UserToken {
    return UserToken.fromValue(dto);
  }

  async findByToken(token: Token) {
    const criteria = new Criteria({
      filters: new Filters([
        new Filter(
          new FilterField('token'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(token.toValue()),
        ),
      ]),
    });

    const result = await this.findByCriteria(criteria);
    return result.data[0] || null;
  }

  async getUserTokens(userId: Id): Promise<UserToken[]> {
    const allTokens = await this.findAll();
    return allTokens.filter((token) => token.userId.equals(userId));
  }

  async revokeAllUserTokens(userId: Id, context?: RepositoryContext): Promise<void> {
    // Delete all tokens
    for (const token of await this.findAll()) {
      if (token.userId.equals(userId)) {
        await this.remove(token.id, context);
      }
    }
  }
}
