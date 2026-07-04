import type { Id } from '@libs/nestjs-common';
import { Base_DomainEvent } from '@libs/nestjs-common';

export class UserLogout_DomainEvent extends Base_DomainEvent {
  constructor(aggregateId: Id) {
    super(aggregateId);
  }
}
