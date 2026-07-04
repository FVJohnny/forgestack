import { Logout_CommandHandler } from './logout.command-handler';
import { Logout_Command } from './logout.command';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  ApplicationException,
  DomainValidationException,
  Id,
  InfrastructureException,
  MockEventBus,
  NotFoundException,
} from '@libs/nestjs-common';
import { UserLogout_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-logout.domain-event';

describe('Logout_CommandHandler', () => {
  const createCommand = (overrides: { userId?: string } = {}) =>
    new Logout_Command(overrides.userId || Id.random().toValue());

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
    const handler = new Logout_CommandHandler(repository, eventBus);

    let user: User | null = null;
    if (withUser) {
      user = User.random();
      await repository.save(user);
    }

    return { repository, eventBus, handler, user };
  };

  describe('Happy Path', () => {
    it('should emit UserLogout domain event', async () => {
      // Arrange
      const { handler, user, eventBus } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act
      await handler.execute(command);

      // Assert - Check that logout event was emitted
      expect(eventBus.events).toHaveLength(1);

      const logoutEvent = eventBus.events[0] as UserLogout_DomainEvent;
      expect(logoutEvent).toBeInstanceOf(UserLogout_DomainEvent);
      expect(logoutEvent.aggregateId.toValue()).toBe(user!.id.toValue());
    });

    it('should handle multiple logout attempts for the same user', async () => {
      // Arrange
      const { handler, user } = await setup({ withUser: true });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act & Assert - Multiple logouts should not fail
      await expect(handler.execute(command)).resolves.not.toThrow();
      await expect(handler.execute(command)).resolves.not.toThrow();
      await expect(handler.execute(command)).resolves.not.toThrow();
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
      const command = createCommand();

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

  describe('Input Validation', () => {
    it('should handle empty userId', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new Logout_Command('');

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should handle invalid userId format', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new Logout_Command('invalid-id');

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent logout attempts for the same user', async () => {
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
