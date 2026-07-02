import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RecordActivity_Command } from './record-activity.command';
import { Base_CommandHandler, EVENT_BUS, Transaction, Id, DateVO } from '@libs/nestjs-common';
import { Activity } from '@bc/analytics/domain/aggregates/activity/activity.aggregate';
import {
  ACTIVITY_REPOSITORY,
  type Activity_Repository,
} from '@bc/analytics/domain/aggregates/activity/activity.repository';

export class RecordActivity_CommandHandler extends Base_CommandHandler(RecordActivity_Command) {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: Activity_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: RecordActivity_Command) {
    const activity = Activity.create({
      userId: new Id(command.userId),
      eventType: command.eventType,
      occurredOn: new DateVO(command.occurredOn),
    });

    await Transaction.run(async (context) => {
      await this.activityRepository.save(activity, context);
      await this.sendDomainEvents(activity);
    });

    this.logger.log(`Activity recorded: ${command.eventType} (User ID: ${command.userId})`);
  }

  async authorize(_command: RecordActivity_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: RecordActivity_Command): Promise<void> {}
}
