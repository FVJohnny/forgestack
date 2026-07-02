import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS } from '@libs/nestjs-common';
import { IntegrationEventHandler, UserCreated_IntegrationEvent } from '@libs/nestjs-common';
import { CorrelationLogger } from '@libs/nestjs-common';
import { RecordActivity_Command } from '@bc/analytics/application/commands/record-activity/record-activity.command';

@IntegrationEventHandler(UserCreated_IntegrationEvent)
export class UserCreated_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserCreated_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: UserCreated_IntegrationEvent) {
    this.logger.log(`📈 Recording activity: user created (User ID: ${event.userId})`);

    const command = new RecordActivity_Command(event.userId, event.name, event.occurredOn);
    await this.commandBus.execute(command);
  }
}
