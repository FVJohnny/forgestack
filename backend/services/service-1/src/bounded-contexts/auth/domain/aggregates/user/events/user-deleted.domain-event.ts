import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';

export class UserDeleted_DomainEvent extends Base_DomainEvent {
  // Carry the email on the event so the publish handler does not have to re-read
  // the user. The user row is removed before the event is published, so a
  // re-read would find nothing.
  constructor(
    userId: Id,
    public readonly email: string,
  ) {
    super(userId);
  }
}
