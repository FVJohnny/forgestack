import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Base_CommandHandler, EVENT_BUS, Id, Transaction } from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/tasks/domain/aggregates/user/user.repository';
import {
  TASK_REPOSITORY,
  type Task_Repository,
} from '@bc/tasks/domain/aggregates/task/task.repository';
import { DeleteUser_Command } from './delete-user.command';

export class DeleteUser_CommandHandler extends Base_CommandHandler(DeleteUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: Task_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: DeleteUser_Command) {
    const userId = new Id(command.userId);

    this.logger.log(
      `Deleting user projection and tasks in tasks context (User ID: ${userId.toValue()})`,
    );

    // Cascade in one transaction: a deleted account leaves no orphaned tasks,
    // and a crash mid-way cannot leave tasks pointing at a missing user.
    await Transaction.run(async (context) => {
      await this.taskRepository.deleteByUserId(userId, context);
      await this.userRepository.remove(userId, context);
    });

    this.logger.log(`User projection and tasks deleted (User ID: ${userId.toValue()})`);
  }

  async authorize(_command: DeleteUser_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: DeleteUser_Command): Promise<void> {}
}
