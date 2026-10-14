import { UserDeleted_IntegrationEvent, MockCommandBus } from '@libs/nestjs-common';
import { DeleteUser_Command } from '@bc/tasks/application/commands/delete-user/delete-user.command';
import { UserDeleted_IntegrationEventHandler } from './user-deleted.integration-event-handler';

describe('UserDeleted_IntegrationEventHandler (tasks context)', () => {
  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserDeleted_IntegrationEventHandler(commandBus);
    return { commandBus, handler };
  };

  it('dispatches DeleteUser_Command with the deleted user id', async () => {
    const { handler, commandBus } = setup();
    const event = UserDeleted_IntegrationEvent.random();

    await handler.handleEvent(event);

    expect(commandBus.commands).toHaveLength(1);
    const command = commandBus.commands[0] as DeleteUser_Command;
    expect(command).toBeInstanceOf(DeleteUser_Command);
    expect(command.userId).toBe(event.userId);
  });

  it('propagates command bus errors', async () => {
    const { handler } = setup({ shouldFailCommandBus: true });

    await expect(handler.handleEvent(UserDeleted_IntegrationEvent.random())).rejects.toThrow(
      'CommandBus execute failed',
    );
  });
});
