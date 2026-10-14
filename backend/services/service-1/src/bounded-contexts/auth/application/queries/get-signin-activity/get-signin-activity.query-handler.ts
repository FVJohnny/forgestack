import { Inject } from '@nestjs/common';
import { Base_QueryHandler, Id, NotFoundException } from '@libs/nestjs-common';
import type { IdentityEntry } from '@bc/auth/domain/identity-entry.type';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { GetSigninActivity_Query } from './get-signin-activity.query';
import type { GetSigninActivity_QueryResponse } from './get-signin-activity.query-response';

export class GetSigninActivity_QueryHandler extends Base_QueryHandler(
  GetSigninActivity_Query,
)<GetSigninActivity_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {
    super();
  }

  async handle(query: GetSigninActivity_Query): Promise<GetSigninActivity_QueryResponse> {
    const user = await this.userRepository.findById(new Id(query.userId));
    if (!user) {
      throw new NotFoundException('User', query.userId);
    }

    const serialize = (entries: IdentityEntry[]) =>
      entries.map((entry) => ({
        value: entry.value,
        firstSeen: entry.firstSeen.toISOString(),
        lastSeen: entry.lastSeen.toISOString(),
        seenCount: entry.seenCount,
      }));

    return {
      lastLogin: user.lastLogin.isNever() ? null : user.lastLogin.toValue().toISOString(),
      ips: serialize(user.ips),
      userAgents: serialize(user.userAgents),
    };
  }

  async authorize(_query: GetSigninActivity_Query) {
    return true;
  }

  async validate(_query: GetSigninActivity_Query) {}
}
