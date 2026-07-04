import { EmailVerified_IntegrationEventHandler } from './email-verified.integration-event-handler';
import { SendEmail_Command } from '@bc/notifications/application/commands';
import { EmailVerified_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';

describe('EmailVerified_IntegrationEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new EmailVerified_IntegrationEventHandler(commandBus);

    return { commandBus, handler };
  };

  describe('handleEvent', () => {
    it('should execute SendEmail_Command with correct parameters', async () => {
      // Arrange
      const { handler, commandBus } = setup();
      const event = EmailVerified_IntegrationEvent.random();

      // Act
      await handler.handleEvent(event);

      // Assert
      expect(commandBus.commands).toHaveLength(1);
      const command = commandBus.commands[0] as SendEmail_Command;
      expect(command).toBeInstanceOf(SendEmail_Command);
      expect(command.email).toBe(event.email);
      expect(command.subject).toBe('Welcome to ForgeStack!');
      expect(command.message).toContain('verified successfully');
      expect(command.message).toContain('fully activated');
    });

    it('should propagate command bus errors', async () => {
      // Arrange
      const { handler } = setup({ shouldFailCommandBus: true });
      const event = EmailVerified_IntegrationEvent.random();

      // Act & Assert
      await expect(handler.handleEvent(event)).rejects.toThrow('CommandBus execute failed');
    });
  });
});
