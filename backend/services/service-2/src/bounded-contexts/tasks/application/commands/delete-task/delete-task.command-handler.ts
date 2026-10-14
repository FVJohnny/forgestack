import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Base_CommandHandler, EVENT_BUS, Id, NotFoundException } from '@libs/nestjs-common';
import {
  TASK_REPOSITORY,
  type Task_Repository,
} from '@bc/tasks/domain/aggregates/task/task.repository';
import { DeleteTask_Command } from './delete-task.command';

export class DeleteTask_CommandHandler extends Base_CommandHandler(DeleteTask_Command) {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: Task_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: DeleteTask_Command) {
    const task = await this.taskRepository.findById(new Id(command.taskId));
    if (!task) {
      throw new NotFoundException('Task', command.taskId);
    }

    await this.taskRepository.remove(task.id);
  }

  // Ownership check: only the task's owner may delete it.
  async authorize(command: DeleteTask_Command) {
    if (!command.requesterUserId) {
      return false;
    }
    const task = await this.taskRepository.findById(new Id(command.taskId));
    if (!task) {
      return true;
    }
    return task.isOwnedBy(new Id(command.requesterUserId));
  }

  async validate(_command: DeleteTask_Command) {}
}
