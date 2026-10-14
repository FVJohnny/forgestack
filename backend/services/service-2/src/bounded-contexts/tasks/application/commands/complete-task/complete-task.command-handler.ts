import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Base_CommandHandler, EVENT_BUS, Id, NotFoundException } from '@libs/nestjs-common';
import {
  TASK_REPOSITORY,
  type Task_Repository,
} from '@bc/tasks/domain/aggregates/task/task.repository';
import { CompleteTask_Command } from './complete-task.command';

export class CompleteTask_CommandHandler extends Base_CommandHandler(CompleteTask_Command) {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: Task_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: CompleteTask_Command) {
    const task = await this.taskRepository.findById(new Id(command.taskId));
    if (!task) {
      throw new NotFoundException('Task', command.taskId);
    }

    task.complete();
    await this.taskRepository.save(task);
  }

  // Ownership check: only the task's owner may complete it. Returning false
  // makes the base handler answer with a ForbiddenException.
  async authorize(command: CompleteTask_Command) {
    if (!command.requesterUserId) {
      return false;
    }
    const task = await this.taskRepository.findById(new Id(command.taskId));
    if (!task) {
      // Let handle() surface the NotFound; authorization has nothing to deny.
      return true;
    }
    return task.isOwnedBy(new Id(command.requesterUserId));
  }

  async validate(_command: CompleteTask_Command) {}
}
