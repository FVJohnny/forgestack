import type { Id } from '@libs/nestjs-common';
import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Email } from '@bc/auth/domain/value-objects';

export class UserPasswordChanged_DomainEvent extends Base_DomainEvent {
  constructor(
    aggregateId: Id,
    public readonly email: Email,
  ) {
    super(aggregateId);
  }
}
