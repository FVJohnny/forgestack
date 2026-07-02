import { Inject } from '@nestjs/common';
import { GetEmailVerificationByUserId_Query } from './get-email-verification-by-user-id.query';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import { Base_QueryHandler, NotFoundException, Id } from '@libs/nestjs-common';
import { GetEmailVerificationByUserId_QueryResponse } from './get-email-verification-by-user-id.query-response';
import { Email } from '@bc/auth/domain/value-objects';

export class GetEmailVerificationByUserId_QueryHandler extends Base_QueryHandler(
  GetEmailVerificationByUserId_Query,
)<GetEmailVerificationByUserId_QueryResponse>() {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
  ) {
    super();
  }

  async handle(
    query: GetEmailVerificationByUserId_Query,
  ): Promise<GetEmailVerificationByUserId_QueryResponse> {
    let emailVerification;

    if (query.userId) {
      emailVerification = await this.emailVerificationRepository.findByUserId(new Id(query.userId));
    } else if (query.email) {
      emailVerification = await this.emailVerificationRepository.findByEmail(
        new Email(query.email),
      );
    } else {
      throw new NotFoundException();
    }

    if (!emailVerification) {
      throw new NotFoundException();
    }

    return emailVerification.toValue();
  }

  async authorize(_query: GetEmailVerificationByUserId_Query) {
    return true;
  }

  async validate(_query: GetEmailVerificationByUserId_Query) {}
}
