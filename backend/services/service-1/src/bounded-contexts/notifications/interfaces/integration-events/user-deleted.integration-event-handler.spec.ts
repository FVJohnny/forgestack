import { Id, UserDeleted_IntegrationEvent } from '@libs/nestjs-common';
import { UserDeleted_IntegrationEventHandler } from './user-deleted.integration-event-handler';
import { User_InMemoryRepository } from '@bc/notifications/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/notifications/domain/aggregates/user/user.aggregate';
import { Email } from '@bc/shared/domain/value-objects';

describe('UserDeleted_IntegrationEventHandler', () => {
  const setup = async (
    params: {
      userId?: Id;
      seedUser?: boolean;
      shouldFailUserRepo?: boolean;
    } = {},
  ) => {
    const userId = params.userId ?? Id.random();
    const userRepository = new User_InMemoryRepository(params.shouldFailUserRepo);

    if (params.seedUser !== false) {
      const user = User.create({ id: userId, email: new Email('deleted@test.com') });
      await userRepository.save(user);
    }

    const handler = new UserDeleted_IntegrationEventHandler(userRepository);

    return { userId, userRepository, handler };
  };

  describe('Cascading Delete', () => {
    it('should delete the user projection', async () => {
      // Arrange
      const userId = Id.random();
      const { handler, userRepository } = await setup({ userId });
      const event = new UserDeleted_IntegrationEvent({
        id: Id.random().toValue(),
        occurredOn: new Date(),
        userId: userId.toValue(),
        email: 'deleted@test.com',
      });

      // Act
      await handler.handleEvent(event);

      // Assert
      const user = await userRepository.findById(userId);
      expect(user).toBeNull();
    });

    it('should not affect projections belonging to other users', async () => {
      // Arrange
      const userToDelete = Id.random();
      const otherUser = Id.random();
      const { handler, userRepository } = await setup({ userId: userToDelete });
      await userRepository.save(User.create({ id: otherUser, email: new Email('other@test.com') }));

      const event = new UserDeleted_IntegrationEvent({
        id: Id.random().toValue(),
        occurredOn: new Date(),
        userId: userToDelete.toValue(),
        email: 'deleted@test.com',
      });

      // Act
      await handler.handleEvent(event);

      // Assert — other user's projection is untouched
      const remaining = await userRepository.findAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id.toValue()).toBe(otherUser.toValue());
    });
  });

  describe('Error Propagation', () => {
    it('should throw when user repository fails', async () => {
      // Arrange
      const userRepository = new User_InMemoryRepository(true); // shouldFail
      const handler = new UserDeleted_IntegrationEventHandler(userRepository);
      const event = UserDeleted_IntegrationEvent.random();

      // Act & Assert
      await expect(handler.handleEvent(event)).rejects.toThrow();
    });
  });
});
