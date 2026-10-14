import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  UserCreated_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { CreateUser_Command } from '@bc/tasks/application/commands/create-user/create-user.command';

@IntegrationEventHandler(UserCreated_IntegrationEvent)
export class UserCreated_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserCreated_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: UserCreated_IntegrationEvent) {
    this.logger.log(`👤 New user registered - ${event.email} (User ID: ${event.userId})`);

    // Create the local user projection this context validates task owners
    // against. Redelivery is safe: the command handler is idempotent.
    const createUserCommand = new CreateUser_Command(event.userId, event.email);
    await this.commandBus.execute(createUserCommand);

    this.logger.log(`User projection created in tasks context (User ID: ${event.userId})`);
  }
}
