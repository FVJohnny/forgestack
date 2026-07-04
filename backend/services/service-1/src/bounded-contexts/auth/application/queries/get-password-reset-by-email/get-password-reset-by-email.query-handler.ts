import { Inject } from '@nestjs/common';
import { GetPasswordResetByEmail_Query } from './get-password-reset-by-email.query';
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordReset_Repository,
} from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import { Base_QueryHandler, NotFoundException } from '@libs/nestjs-common';
import { GetPasswordResetByEmail_QueryResponse } from './get-password-reset-by-email.query-response';
import { Email } from '@bc/auth/domain/value-objects';

export class GetPasswordResetByEmail_QueryHandler extends Base_QueryHandler(
  GetPasswordResetByEmail_Query,
)<GetPasswordResetByEmail_QueryResponse>() {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: PasswordReset_Repository,
  ) {
    super();
  }

  async handle(
    query: GetPasswordResetByEmail_Query,
  ): Promise<GetPasswordResetByEmail_QueryResponse> {
    const passwordReset = await this.passwordResetRepository.findByEmail(new Email(query.email));

    if (!passwordReset) {
      throw new NotFoundException();
    }

    return passwordReset.toValue();
  }

  async authorize(_query: GetPasswordResetByEmail_Query) {
    return true;
  }

  async validate(_query: GetPasswordResetByEmail_Query) {}
}
