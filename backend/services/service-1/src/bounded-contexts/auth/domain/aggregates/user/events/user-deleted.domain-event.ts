import { Base_DomainEvent } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';

export class UserDeleted_DomainEvent extends Base_DomainEvent {
  constructor(userId: Id) {
    super(userId);
  }
}
