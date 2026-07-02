import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';
import type { Email } from '@bc/auth/domain/value-objects';

export class EmailVerificationVerified_DomainEvent extends Base_DomainEvent {
  constructor(
    public readonly emailVerificationId: Id,
    public readonly userId: Id,
    public readonly email: Email,
  ) {
    super(emailVerificationId);
  }
}
