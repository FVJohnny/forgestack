import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  UserDeleted_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { DeleteUser_Command } from '@bc/notifications/application/commands/delete-user/delete-user.command';

@IntegrationEventHandler(UserDeleted_IntegrationEvent)
export class UserDeleted_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserDeleted_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: UserDeleted_IntegrationEvent): Promise<void> {
    this.logger.log(
      `🗑️  User deleted event received - deleting notifications data for user: ${event.userId}`,
    );

    // Delete the local user projection
    const deleteUserCommand = new DeleteUser_Command(event.userId);
    await this.commandBus.execute(deleteUserCommand);

    this.logger.log(`User projection deleted in notifications context (User ID: ${event.userId})`);
  }
}
