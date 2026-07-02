import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { UserLogout_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-logout.domain-event';
import { Base_DomainEventHandler, COMMAND_BUS } from '@libs/nestjs-common';
import { RevokeAllUserTokens_Command } from '@bc/auth/application/commands';

export class UserLogout_RevokeTokens_DomainEventHandler extends Base_DomainEventHandler(
  UserLogout_DomainEvent,
) {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {
    super();
  }

  async handleEvent(event: UserLogout_DomainEvent) {
    // Revoke all tokens for this user via command
    const command = new RevokeAllUserTokens_Command(event.aggregateId.toValue());
    await this.commandBus.execute(command);
  }
}
