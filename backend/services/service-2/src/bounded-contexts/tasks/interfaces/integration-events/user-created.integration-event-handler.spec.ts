import { UserCreated_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';
import { CreateUser_Command } from '@bc/tasks/application/commands/create-user/create-user.command';
import { UserCreated_IntegrationEventHandler } from './user-created.integration-event-handler';

describe('UserCreated_IntegrationEventHandler (tasks context)', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserCreated_IntegrationEventHandler(commandBus);
    return { commandBus, handler };
  };

  it('dispatches CreateUser_Command with the event values', async () => {
    const { handler, commandBus } = setup();
    const event = UserCreated_IntegrationEvent.random();

    await handler.handleEvent(event);

    expect(commandBus.commands).toHaveLength(1);
    const command = commandBus.commands[0] as CreateUser_Command;
    expect(command).toBeInstanceOf(CreateUser_Command);
    expect(command.userId).toBe(event.userId);
    expect(command.email).toBe(event.email);
  });

  it('propagates command bus errors', async () => {
    const { handler } = setup({ shouldFailCommandBus: true });

    await expect(handler.handleEvent(UserCreated_IntegrationEvent.random())).rejects.toThrow(
      'CommandBus execute failed',
    );
  });
});
