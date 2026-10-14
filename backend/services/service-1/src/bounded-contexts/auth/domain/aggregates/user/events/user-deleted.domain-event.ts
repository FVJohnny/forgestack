import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';

export class UserDeleted_DomainEvent extends Base_DomainEvent {
  // Carry the email on the event so handlers never need to re-read the user:
  // the row is already removed by the time the event is published (after the
  // delete commits). The UserDeleted integration event is written to the outbox
  // by DeleteUser_CommandHandler inside the delete's transaction, not from here.
  constructor(
    userId: Id,
    public readonly email: string,
  ) {
    super(userId);
  }
}
