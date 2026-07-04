import { Id, MockEventBus } from '@libs/nestjs-common';
import { DeleteUser_CommandHandler } from './delete-user.command-handler';
import { DeleteUser_Command } from './delete-user.command';
import { User_InMemoryRepository } from '@bc/notifications/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/notifications/domain/aggregates/user/user.aggregate';
import { Email } from '@bc/shared/domain/value-objects';

describe('DeleteUser_CommandHandler', () => {
  const setup = async (
    params: {
      userId?: Id;
      seedUser?: boolean;
      shouldFailUserRepo?: boolean;
    } = {},
  ) => {
    const userId = params.userId ?? Id.random();
    const userRepository = new User_InMemoryRepository(params.shouldFailUserRepo);
    const eventBus = new MockEventBus();

    if (params.seedUser !== false && !params.shouldFailUserRepo) {
      const user = User.create({ id: userId, email: new Email('deleted@test.com') });
      await userRepository.save(user);
    }

    const handler = new DeleteUser_CommandHandler(userRepository, eventBus);

    return { userId, userRepository, handler };
  };

  describe('Happy Path', () => {
    it('should delete the user projection', async () => {
      // Arrange
      const { handler, userId, userRepository } = await setup();

      // Act
      await handler.execute(new DeleteUser_Command(userId.toValue()));

      // Assert
      const user = await userRepository.findById(userId);
      expect(user).toBeNull();
    });

    it('should not affect projections belonging to other users', async () => {
      // Arrange
      const { handler, userId, userRepository } = await setup();
      const otherUser = User.create({ id: Id.random(), email: new Email('other@test.com') });
      await userRepository.save(otherUser);

      // Act
      await handler.execute(new DeleteUser_Command(userId.toValue()));

      // Assert
      const remaining = await userRepository.findAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id.toValue()).toBe(otherUser.id.toValue());
    });
  });

  describe('Error Propagation', () => {
    it('should throw when the user repository fails', async () => {
      // Arrange
      const { handler } = await setup({ shouldFailUserRepo: true });

      // Act & Assert
      await expect(
        handler.execute(new DeleteUser_Command(Id.random().toValue())),
      ).rejects.toThrow();
    });
  });
});
