import type { ICommandBus } from '@nestjs/cqrs';
import { Id } from '@libs/nestjs-common';
import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';
import { DeleteEmailVerificationByUserId_Command } from '@bc/auth/application/commands/delete-email-verification-by-user-id/delete-email-verification-by-user-id.command';
import { UserDeleted_DeleteEmailVerification_DomainEventHandler } from './user-deleted_delete-email-verification.domain-event-handler';

describe('UserDeleted_DeleteEmailVerification_DomainEventHandler', () => {
  const setup = () => {
    const executed: unknown[] = [];
    const commandBus = {
      execute: jest.fn().mockImplementation(async (cmd: unknown) => {
        executed.push(cmd);
      }),
    } as unknown as ICommandBus;

    const handler = new UserDeleted_DeleteEmailVerification_DomainEventHandler(commandBus);
    return { handler, commandBus, executed };
  };

  it('should dispatch DeleteEmailVerificationByUserId_Command with the deleted user id', async () => {
    const { handler, executed } = setup();
    const userId = Id.random();

    await handler.handle(new UserDeleted_DomainEvent(userId));

    expect(executed).toHaveLength(1);
    const cmd = executed[0] as DeleteEmailVerificationByUserId_Command;
    expect(cmd).toBeInstanceOf(DeleteEmailVerificationByUserId_Command);
    expect(cmd.userId).toBe(userId.toValue());
  });
});
