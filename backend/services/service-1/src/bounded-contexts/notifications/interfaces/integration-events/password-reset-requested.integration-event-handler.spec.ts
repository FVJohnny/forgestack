import { PasswordResetRequested_IntegrationEventHandler } from './password-reset-requested.integration-event-handler';
import { SendEmail_Command } from '@bc/notifications/application/commands';
import { PasswordResetRequested_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';

describe('PasswordResetRequested_IntegrationEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new PasswordResetRequested_IntegrationEventHandler(commandBus);

    return { commandBus, handler };
  };

  describe('handleEvent', () => {
    it('should execute SendEmail_Command with correct parameters', async () => {
      // Arrange
      const { handler, commandBus } = setup();
      const event = PasswordResetRequested_IntegrationEvent.random();

      // Act
      await handler.handleEvent(event);

      // Assert
      expect(commandBus.commands).toHaveLength(1);
      const command = commandBus.commands[0] as SendEmail_Command;
      expect(command).toBeInstanceOf(SendEmail_Command);
      expect(command.email).toBe(event.email);
      expect(command.subject).toBe('Reset your password');
      expect(command.message).toContain(event.passwordResetId);
      expect(command.message).toContain('reset your password');
    });

    it('should propagate command bus errors', async () => {
      // Arrange
      const { handler } = setup({ shouldFailCommandBus: true });
      const event = PasswordResetRequested_IntegrationEvent.random();

      // Act & Assert
      await expect(handler.handleEvent(event)).rejects.toThrow('CommandBus execute failed');
    });
  });
});
