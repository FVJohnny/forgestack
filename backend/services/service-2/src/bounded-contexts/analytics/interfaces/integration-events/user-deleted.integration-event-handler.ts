import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS } from '@libs/nestjs-common';
import { IntegrationEventHandler, UserDeleted_IntegrationEvent } from '@libs/nestjs-common';
import { CorrelationLogger } from '@libs/nestjs-common';
import { RecordActivity_Command } from '@bc/analytics/application/commands/record-activity/record-activity.command';

@IntegrationEventHandler(UserDeleted_IntegrationEvent)
export class UserDeleted_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserDeleted_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: UserDeleted_IntegrationEvent) {
    this.logger.log(`📉 Recording activity: user deleted (User ID: ${event.userId})`);

    const command = new RecordActivity_Command(event.userId, event.name, event.occurredOn);
    await this.commandBus.execute(command);
  }
}
