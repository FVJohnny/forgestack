import { UserDeleted_IntegrationEventHandler } from './user-deleted.integration-event-handler';
import { DeleteUser_Command } from '@bc/notifications/application/commands/delete-user/delete-user.command';
import { UserDeleted_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';

describe('UserDeleted_IntegrationEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserDeleted_IntegrationEventHandler(commandBus);

    return { commandBus, handler };
  };

  describe('handleEvent', () => {
    it('should execute DeleteUser_Command with correct parameters', async () => {
      // Arrange
      const { handler, commandBus } = setup();
      const event = UserDeleted_IntegrationEvent.random();

      // Act
      await handler.handleEvent(event);

      // Assert
      expect(commandBus.commands).toHaveLength(1);
      const command = commandBus.commands[0] as DeleteUser_Command;
      expect(command).toBeInstanceOf(DeleteUser_Command);
      expect(command.userId).toBe(event.userId);
    });

    it('should propagate command bus errors', async () => {
      // Arrange
      const { handler } = setup({ shouldFailCommandBus: true });
      const event = UserDeleted_IntegrationEvent.random();

      // Act & Assert
      await expect(handler.handleEvent(event)).rejects.toThrow('CommandBus execute failed');
    });
  });
});
