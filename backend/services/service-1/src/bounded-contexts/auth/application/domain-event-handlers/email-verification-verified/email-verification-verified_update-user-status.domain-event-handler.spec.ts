import { EmailVerificationVerified_UpdateUserStatus_DomainEventHandler } from './email-verification-verified_update-user-status.domain-event-handler';
import { EmailVerificationVerified_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verified.domain-event';
import { Email } from '@bc/auth/domain/value-objects';
import { Id, MockCommandBus } from '@libs/nestjs-common';
import { VerifyUserEmail_Command } from '@bc/auth/application/commands';

describe('EmailVerificationVerified_UpdateUserStatus_DomainEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const eventHandler = new EmailVerificationVerified_UpdateUserStatus_DomainEventHandler(
      commandBus,
    );

    return { commandBus, eventHandler };
  };

  it('should execute VerifyUserEmail command when email verification is verified', async () => {
    // Arrange
    const { eventHandler, commandBus } = setup();
    const userId = Id.random();
    const event = new EmailVerificationVerified_DomainEvent(Id.random(), userId, Email.random());

    // Act
    await eventHandler.handle(event);

    // Assert
    expect(commandBus.commands).toHaveLength(1);
    expect(commandBus.commands[0]).toBeInstanceOf(VerifyUserEmail_Command);

    const command = commandBus.commands[0] as VerifyUserEmail_Command;
    expect(command.userId).toBe(userId.toValue());
  });

  it('should propagate command bus errors', async () => {
    // Arrange
    const { eventHandler } = setup({ shouldFailCommandBus: true });
    const event = new EmailVerificationVerified_DomainEvent(
      Id.random(),
      Id.random(),
      Email.random(),
    );

    // Act & Assert
    await expect(eventHandler.handle(event)).rejects.toThrow('CommandBus execute failed');
  });
});
