import { UserRegistered_CreateEmailVerification_DomainEventHandler } from './user-registered_create-email-verification.domain-event-handler';
import { UserRegistered_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-registered.domain-event';
import { MockCommandBus } from '@libs/nestjs-common';
import { CreateEmailVerification_Command } from '@bc/auth/application/commands/create-email-verification/create-email-verification.command';
import { User, type AuthProvider } from '@bc/auth/domain/aggregates/user/user.aggregate';

describe('UserRegistered_CreateEmailVerification_DomainEventHandler', () => {
  const createEventFromUser = (user: User, authProvider: AuthProvider = 'email') =>
    new UserRegistered_DomainEvent(user.id, user.email, user.role, authProvider);

  // Setup factory
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const mockCommandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const eventHandler = new UserRegistered_CreateEmailVerification_DomainEventHandler(
      mockCommandBus,
    );

    return { mockCommandBus, eventHandler };
  };

  describe('Happy Path', () => {
    it('should execute CreateEmailVerificationCommand with correct user data', async () => {
      // Arrange
      const { eventHandler, mockCommandBus } = setup();
      const user = User.random();
      const event = createEventFromUser(user);

      // Act
      await eventHandler.handle(event);

      // Assert
      expect(mockCommandBus.commands).toHaveLength(1);
      const command = mockCommandBus.commands[0] as CreateEmailVerification_Command;

      expect(command).toBeInstanceOf(CreateEmailVerification_Command);
      expect(command.userId).toBe(user.id.toValue());
      expect(command.email).toBe(user.email.toValue());
      expect(command.emailAlreadyVerified).toBe(false);
    });

    it('should mark email as already verified for Google signups', async () => {
      // Arrange
      const { eventHandler, mockCommandBus } = setup();
      const user = User.random();
      const event = createEventFromUser(user, 'google');

      // Act
      await eventHandler.handle(event);

      // Assert
      const command = mockCommandBus.commands[0] as CreateEmailVerification_Command;
      expect(command.emailAlreadyVerified).toBe(true);
    });

    it('should NOT mark email as verified for email signups', async () => {
      // Arrange
      const { eventHandler, mockCommandBus } = setup();
      const event = createEventFromUser(User.random(), 'email');

      // Act
      await eventHandler.handle(event);

      // Assert
      const command = mockCommandBus.commands[0] as CreateEmailVerification_Command;
      expect(command.emailAlreadyVerified).toBe(false);
    });

    it('should handle multiple events sequentially', async () => {
      // Arrange
      const { eventHandler, mockCommandBus } = setup();
      const users = [User.random(), User.random(), User.random()];
      const events = users.map((user) => createEventFromUser(user));

      // Act
      for (const event of events) {
        await eventHandler.handle(event);
      }

      // Assert
      expect(mockCommandBus.commands).toHaveLength(3);

      const command1 = mockCommandBus.commands[0] as CreateEmailVerification_Command;
      expect(command1.userId).toBe(users[0].id.toValue());
      expect(command1.email).toBe(users[0].email.toValue());

      const command2 = mockCommandBus.commands[1] as CreateEmailVerification_Command;
      expect(command2.userId).toBe(users[1].id.toValue());
      expect(command2.email).toBe(users[1].email.toValue());

      const command3 = mockCommandBus.commands[2] as CreateEmailVerification_Command;
      expect(command3.userId).toBe(users[2].id.toValue());
      expect(command3.email).toBe(users[2].email.toValue());
    });
  });

  describe('Error Cases', () => {
    it('should propagate command bus exception', async () => {
      // Arrange
      const { eventHandler } = setup({ shouldFailCommandBus: true });
      const user = User.random();
      const event = createEventFromUser(user);

      // Act & Assert
      await expect(eventHandler.handle(event)).rejects.toThrow('CommandBus execute failed');
    });
  });
});
