import { Id, SharedAggregateDTO } from '@libs/nestjs-common';
import { Email, Expiration, Verification } from '@bc/auth/domain/value-objects';

export class EmailVerificationDTO extends SharedAggregateDTO {
  userId: string;
  email: string;
  expiration: Date;
  verification: Date;

  static random(): EmailVerificationDTO {
    return {
      ...SharedAggregateDTO.random(),

      userId: Id.random().toValue(),
      email: Email.random().toValue(),
      expiration: Expiration.atHoursFromNow(24).toValue(),
      verification: Verification.notVerified().toValue(),
    };
  }
}
