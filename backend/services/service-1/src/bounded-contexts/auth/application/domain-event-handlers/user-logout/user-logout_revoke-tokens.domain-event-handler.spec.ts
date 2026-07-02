import { UserLogout_RevokeTokens_DomainEventHandler } from './user-logout_revoke-tokens.domain-event-handler';
import { UserLogout_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-logout.domain-event';
import { Id, MockCommandBus } from '@libs/nestjs-common';
import type { RevokeAllUserTokens_Command } from '@bc/auth/application/commands';

describe('UserLogout_RevokeTokens_DomainEventHandler', () => {
  const createEvent = () => new UserLogout_DomainEvent(Id.random());

  const setup = (params: { shouldFailCommandBus?: boolean } = {}) => {
    const commandBus = new MockCommandBus({ shouldFail: params.shouldFailCommandBus });
    const handler = new UserLogout_RevokeTokens_DomainEventHandler(commandBus);

    return { handler, commandBus };
  };

  it('should execute revoke all user tokens command', async () => {
    const { handler, commandBus } = setup();
    const event = createEvent();

    await handler.handle(event);

    expect(commandBus.commands).toHaveLength(1);
    const command = commandBus.commands[0] as RevokeAllUserTokens_Command;
    expect(command.userId).toBe(event.aggregateId.toValue());
  });

  it('errors thrown by the command bus are propagated', async () => {
    const { handler } = setup({ shouldFailCommandBus: true });
    const event = createEvent();

    await expect(handler.handle(event)).rejects.toThrow();
  });

  it('should handle multiple events sequentially', async () => {
    const { handler, commandBus } = setup();
    const event1 = createEvent();
    const event2 = createEvent();
    const event3 = createEvent();

    await handler.handle(event1);
    await handler.handle(event2);
    await handler.handle(event3);

    expect(commandBus.commands).toHaveLength(3);
    expect(commandBus.commands[0]).toHaveProperty('userId', event1.aggregateId.toValue());
    expect(commandBus.commands[1]).toHaveProperty('userId', event2.aggregateId.toValue());
    expect(commandBus.commands[2]).toHaveProperty('userId', event3.aggregateId.toValue());
  });
});
