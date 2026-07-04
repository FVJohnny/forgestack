import { Inject } from '@nestjs/common';
import { GetUserTokenByToken_Query } from './get-user-token-by-token.query';
import {
  USER_TOKEN_REPOSITORY,
  type UserToken_Repository,
} from '../../../domain/repositories/user-token.repository';
import { Base_QueryHandler } from '../../../../cqrs/base.query-handler';
import { NotFoundException } from '../../../../errors/application.exceptions';
import { GetUserTokenByToken_QueryResponse } from './get-user-token-by-token.query-response';
import { Token } from '../../../domain/entities/token.vo';

export class GetUserTokenByToken_QueryHandler extends Base_QueryHandler(
  GetUserTokenByToken_Query,
)<GetUserTokenByToken_QueryResponse>() {
  constructor(
    @Inject(USER_TOKEN_REPOSITORY)
    private readonly userTokenRepository: UserToken_Repository,
  ) {
    super();
  }

  async handle(query: GetUserTokenByToken_Query): Promise<GetUserTokenByToken_QueryResponse> {
    const userToken = await this.userTokenRepository.findByToken(new Token(query.token));

    if (!userToken) {
      throw new NotFoundException();
    }

    return userToken.toValue();
  }

  async authorize(_query: GetUserTokenByToken_Query) {
    return true;
  }

  async validate(_query: GetUserTokenByToken_Query) {}
}
