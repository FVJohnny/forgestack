import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS } from '@libs/nestjs-common';
import { IntegrationEventHandler, UserCreated_IntegrationEvent } from '@libs/nestjs-common';
import { CorrelationLogger } from '@libs/nestjs-common';
import { CreateUser_Command } from '@bc/notifications/application/commands/create-user/create-user.command';

@IntegrationEventHandler(UserCreated_IntegrationEvent)
export class UserCreated_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserCreated_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: UserCreated_IntegrationEvent) {
    this.logger.log(
      `👤 New user registered - ${event.email} (User ID: ${event.userId}, Role: ${event.role})`,
    );

    // Create local user projection for email lookup
    const createUserCommand = new CreateUser_Command(event.userId, event.email);
    await this.commandBus.execute(createUserCommand);

    this.logger.log(`User projection created in notifications context (User ID: ${event.userId})`);
  }
}
