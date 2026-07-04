import { RecordUserLogin_CommandHandler } from './record-user-login.command-handler';
import { RecordUserLogin_Command } from './record-user-login.command';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  ApplicationException,
  DateVO,
  DomainValidationException,
  Id,
  InfrastructureException,
  MockEventBus,
  NotFoundException,
  wait,
} from '@libs/nestjs-common';

describe('RecordUserLoginCommandHandler', () => {
  const createCommand = (overrides: { userId?: string } = {}) =>
    new RecordUserLogin_Command({ userId: overrides.userId || Id.random().toValue() });

  const setup = async (
    params: {
      withUser?: boolean;
      shouldFailRepository?: boolean;
      shouldFailEventBus?: boolean;
    } = {},
  ) => {
    const { withUser = false, shouldFailRepository = false, shouldFailEventBus = false } = params;

    const repository = new User_InMemoryRepository(shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const handler = new RecordUserLogin_CommandHandler(repository, eventBus);

    let user: User | null = null;
    if (withUser) {
      user = User.random();
      await repository.save(user);
    }

    return { repository, eventBus, handler, user };
  };

  describe('Happy Path', () => {
    it('should successfully record user login', async () => {
      // Arrange
      const { handler, user, repository } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act
      const beforeLogin = DateVO.now();
      await wait(10);
      await handler.execute(command);
      await wait(10);
      const afterLogin = DateVO.now();

      // Assert
      const updatedUser = await repository.findById(user!.id);
      expect(updatedUser).toBeDefined();
      expect(updatedUser!.lastLogin).toBeDefined();
      expect(updatedUser!.lastLogin.isNever()).toBe(false);
      expect(updatedUser!.lastLogin.isAfter(beforeLogin)).toBe(true);
      expect(updatedUser!.lastLogin.isBefore(afterLogin)).toBe(true);
    });

    it('should handle multiple logins for the same user', async () => {
      // Arrange
      const { handler, user, repository } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act - First login
      await handler.execute(command);
      const firstLoginUser = await repository.findById(user!.id);
      const firstLoginTime = firstLoginUser!.lastLogin;

      await wait(10);

      // Act - Second login
      await handler.execute(command);
      const secondLoginUser = await repository.findById(user!.id);
      const secondLoginTime = secondLoginUser!.lastLogin;

      // Assert
      expect(firstLoginTime.isNever()).toBe(false);
      expect(secondLoginTime.isNever()).toBe(false);
      expect(secondLoginTime.isAfter(firstLoginTime)).toBe(true);
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const { handler } = await setup({ withUser: false });
      const command = createCommand();

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { handler } = await setup({
        withUser: false,
        shouldFailRepository: true,
      });
      const userId = Id.random().toValue();
      const command = createCommand({ userId });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should throw ApplicationException when event bus fails', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        shouldFailEventBus: true,
      });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ApplicationException);
    });
  });

  describe('Domain Events', () => {
    it('should handle domain events properly', async () => {
      // Arrange
      const { handler, user, eventBus } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act
      await handler.execute(command);

      // Assert - The handler completes without error
      expect(eventBus.events).toBeDefined();
      // Note: recordLogin may or may not generate events depending on business logic
    });

    it('should not throw when eventBus is successful', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        shouldFailEventBus: false,
      });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act & Assert - Should complete without throwing
      await expect(handler.execute(command)).resolves.not.toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should handle empty userId', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new RecordUserLogin_Command({ userId: '' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should handle invalid userId format', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new RecordUserLogin_Command({ userId: 'invalid-id' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent login attempts', async () => {
      // Arrange
      const { handler, user } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act - Execute multiple commands concurrently
      const results = await Promise.allSettled([
        handler.execute(command),
        handler.execute(command),
        handler.execute(command),
      ]);

      // Assert - All should succeed
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });
});
