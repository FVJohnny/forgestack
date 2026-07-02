import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { Id, Outbox_InMemoryRepository } from '@libs/nestjs-common';
import { UserDeleted_PublishIntegrationEvent_DomainEventHandler } from './user-deleted_publish-integration-event.domain-event-handler';

describe('UserDeleted_PublishIntegrationEvent_DomainEventHandler', () => {
  const setup = () => {
    const outboxRepository = new Outbox_InMemoryRepository();
    const userRepository = new User_InMemoryRepository();
    const handler = new UserDeleted_PublishIntegrationEvent_DomainEventHandler(
      outboxRepository,
      userRepository,
    );
    return { outboxRepository, userRepository, handler };
  };

  describe('Happy Path', () => {
    it('should publish a UserDeleted integration event to the outbox', async () => {
      const { handler, userRepository, outboxRepository } = setup();
      const user = User.random({
        role: UserRole.user(),
        status: UserStatus.active(),
      });
      await userRepository.save(user);

      const domainEvent = new UserDeleted_DomainEvent(user.id);
      await handler.handle(domainEvent);

      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(1);
    });

    it('should include the correct userId and email in the integration event', async () => {
      const { handler, userRepository, outboxRepository } = setup();
      const user = User.random({
        role: UserRole.user(),
        status: UserStatus.active(),
      });
      await userRepository.save(user);

      const domainEvent = new UserDeleted_DomainEvent(user.id);
      await handler.handle(domainEvent);

      const outboxEvents = await outboxRepository.findAll();
      const payload = JSON.parse(outboxEvents[0].payload.toValue());
      expect(payload.userId).toBe(user.id.toValue());
      expect(payload.email).toBe(user.email.toValue());
    });
  });

  describe('Graceful Missing User Handling', () => {
    it('should not throw when user is not found', async () => {
      const { handler } = setup();
      const nonExistentId = Id.random();

      const domainEvent = new UserDeleted_DomainEvent(nonExistentId);

      // Should complete without throwing
      await expect(handler.handle(domainEvent)).resolves.not.toThrow();
    });

    it('should not publish an outbox event when user is not found', async () => {
      const { handler, outboxRepository } = setup();
      const nonExistentId = Id.random();

      const domainEvent = new UserDeleted_DomainEvent(nonExistentId);
      await handler.handle(domainEvent);

      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(0);
    });
  });
});
