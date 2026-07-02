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
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';

export class UserDeleted_PublishIntegrationEvent_DomainEventHandler extends Base_DomainEventHandler(
  UserDeleted_DomainEvent,
) {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: Outbox_Repository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {
    super();
  }

  async handleEvent(event: UserDeleted_DomainEvent) {
    // Fetch user to get email for the integration event
    const user = await this.userRepository.findById(event.aggregateId);
    if (!user) {
      this.logger.warn(
        `User ${event.aggregateId.toValue()} not found when publishing UserDeleted integration event`,
      );
      return;
    }

    const integrationEvent = new UserDeleted_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: event.aggregateId.toValue(),
      email: user.email.toValue(),
    });

    const outboxEvent = OutboxEvent.create(integrationEvent);
    await this.outboxRepository.save(outboxEvent);

    this.logger.log(
      `Published UserDeleted integration event for user ${event.aggregateId.toValue()}`,
    );
  }
}
