import { UserCreated_IntegrationEventHandler } from './user-created.integration-event-handler';
import { CreateUser_Command } from '@bc/notifications/application/commands/create-user/create-user.command';
import { UserCreated_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';

describe('UserCreated_IntegrationEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserCreated_IntegrationEventHandler(commandBus);

    return { commandBus, handler };
  };

  describe('handleEvent', () => {
    it('should execute CreateUser_Command with correct parameters', async () => {
      // Arrange
      const { handler, commandBus } = setup();
      const event = UserCreated_IntegrationEvent.random();

      // Act
      await handler.handleEvent(event);

      // Assert
      expect(commandBus.commands).toHaveLength(1);
      const command = commandBus.commands[0] as CreateUser_Command;
      expect(command).toBeInstanceOf(CreateUser_Command);
      expect(command.userId).toBe(event.userId);
      expect(command.email).toBe(event.email);
    });

    it('should propagate command bus errors', async () => {
      // Arrange
      const { handler } = setup({ shouldFailCommandBus: true });
      const event = UserCreated_IntegrationEvent.random();

      // Act & Assert
      await expect(handler.handleEvent(event)).rejects.toThrow('CommandBus execute failed');
    });
  });
});
