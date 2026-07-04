import { Inject } from '@nestjs/common';
import { SearchUsers_Query } from './search-users.query';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Base_QueryHandler } from '@libs/nestjs-common';
import { SearchUsers_QueryResponse } from './search-users.query-response';

export class SearchUsers_QueryHandler extends Base_QueryHandler(
  SearchUsers_Query,
)<SearchUsers_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {
    super();
  }

  async handle(query: SearchUsers_Query): Promise<SearchUsers_QueryResponse> {
    const users = await this.userRepository.searchByEmail(query.email, query.limit);

    return {
      users: users.map((user) => ({
        id: user.id.toValue(),
        email: user.email.toValue(),
        role: user.role.toValue(),
        status: user.status.toValue(),
        createdAt: user.timestamps.createdAt.toValue(),
      })),
    };
  }

  async authorize(_query: SearchUsers_Query) {
    return true;
  }

  async validate(_query: SearchUsers_Query) {}
}
