import { UserCreated_IntegrationEventHandler } from './user-created.integration-event-handler';
import { RecordActivity_Command } from '@bc/analytics/application/commands/record-activity/record-activity.command';
import { UserCreated_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';

describe('UserCreated_IntegrationEventHandler', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserCreated_IntegrationEventHandler(commandBus);

    return { commandBus, handler };
  };

  it('should execute RecordActivity_Command with the event values', async () => {
    // Arrange
    const { handler, commandBus } = setup();
    const event = UserCreated_IntegrationEvent.random();

    // Act
    await handler.handleEvent(event);

    // Assert
    expect(commandBus.commands).toHaveLength(1);
    const command = commandBus.commands[0] as RecordActivity_Command;
    expect(command).toBeInstanceOf(RecordActivity_Command);
    expect(command.userId).toBe(event.userId);
    expect(command.eventType).toBe(event.name);
    expect(command.occurredOn).toBe(event.occurredOn);
  });

  it('should propagate command bus errors', async () => {
    // Arrange
    const { handler } = setup({ shouldFailCommandBus: true });
    const event = UserCreated_IntegrationEvent.random();

    // Act & Assert
    await expect(handler.handleEvent(event)).rejects.toThrow('CommandBus execute failed');
  });
});
