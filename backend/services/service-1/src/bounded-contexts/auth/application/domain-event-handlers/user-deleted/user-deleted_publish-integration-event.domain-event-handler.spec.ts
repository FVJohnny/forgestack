import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';
import { Id, Outbox_InMemoryRepository } from '@libs/nestjs-common';
import { UserDeleted_PublishIntegrationEvent_DomainEventHandler } from './user-deleted_publish-integration-event.domain-event-handler';

describe('UserDeleted_PublishIntegrationEvent_DomainEventHandler', () => {
  const setup = () => {
    const outboxRepository = new Outbox_InMemoryRepository();
    const handler = new UserDeleted_PublishIntegrationEvent_DomainEventHandler(outboxRepository);
    return { outboxRepository, handler };
  };

  describe('Happy Path', () => {
    it('should publish a UserDeleted integration event to the outbox', async () => {
      const { handler, outboxRepository } = setup();

      const domainEvent = new UserDeleted_DomainEvent(Id.random(), 'deleted@example.com');
      await handler.handle(domainEvent);

      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(1);
    });

    it('should include the userId and email carried on the domain event', async () => {
      const { handler, outboxRepository } = setup();
      const userId = Id.random();

      // The email travels on the domain event, so the handler does not re-read
      // the (already removed) user.
      const domainEvent = new UserDeleted_DomainEvent(userId, 'deleted@example.com');
      await handler.handle(domainEvent);

      const outboxEvents = await outboxRepository.findAll();
      const payload = JSON.parse(outboxEvents[0].payload.toValue());
      expect(payload.userId).toBe(userId.toValue());
      expect(payload.email).toBe('deleted@example.com');
    });
  });
});
