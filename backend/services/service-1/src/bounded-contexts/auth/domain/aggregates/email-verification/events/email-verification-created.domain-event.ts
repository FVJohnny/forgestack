import type { Id } from '@libs/nestjs-common';
import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Email, Expiration } from '@bc/auth/domain/value-objects';

export class EmailVerificationCreated_DomainEvent extends Base_DomainEvent {
  constructor(
    public readonly emailVerificationId: Id,
    public readonly userId: Id,
    public readonly email: Email,
    public readonly expiration: Expiration,
  ) {
    super(emailVerificationId);
  }
}
