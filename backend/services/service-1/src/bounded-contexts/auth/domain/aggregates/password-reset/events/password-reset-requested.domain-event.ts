import type { Id } from '@libs/nestjs-common';
import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Email, Expiration } from '@bc/auth/domain/value-objects';

export class PasswordResetRequested_DomainEvent extends Base_DomainEvent {
  constructor(
    public readonly passwordResetId: Id,
    public readonly email: Email,
    public readonly expiration: Expiration,
  ) {
    super(passwordResetId);
  }
}
