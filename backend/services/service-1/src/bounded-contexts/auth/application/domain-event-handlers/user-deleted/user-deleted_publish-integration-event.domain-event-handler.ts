import { Inject } from '@nestjs/common';
import {
  Base_DomainEventHandler,
  Id,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  UserDeleted_IntegrationEvent,
  OutboxEvent,
} from '@libs/nestjs-common';
import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';

export class UserDeleted_PublishIntegrationEvent_DomainEventHandler extends Base_DomainEventHandler(
  UserDeleted_DomainEvent,
) {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: Outbox_Repository,
  ) {
    super();
  }

  async handleEvent(event: UserDeleted_DomainEvent) {
    // The email travels on the domain event, so we do not re-read the user. The
    // command handler removes the user row before publishing, so a re-read would
    // find nothing.
    const integrationEvent = new UserDeleted_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: event.aggregateId.toValue(),
      email: event.email,
    });

    const outboxEvent = OutboxEvent.create(integrationEvent);
    await this.outboxRepository.save(outboxEvent);

    this.logger.log(
      `Published UserDeleted integration event for user ${event.aggregateId.toValue()}`,
    );
  }
}
