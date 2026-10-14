import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  NotFoundException,
  Transaction,
} from '@libs/nestjs-common';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { TaskTitle } from '@bc/tasks/domain/value-objects';
import {
  TASK_REPOSITORY,
  type Task_Repository,
} from '@bc/tasks/domain/aggregates/task/task.repository';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/tasks/domain/aggregates/user/user.repository';
import { CreateTask_Command } from './create-task.command';

export class CreateTask_CommandHandler extends Base_CommandHandler(CreateTask_Command) {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: Task_Repository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: CreateTask_Command) {
    const task = Task.create({
      userId: new Id(command.requesterUserId!),
      title: new TaskTitle(command.title),
    });

    await Transaction.run(async (context) => {
      await this.taskRepository.save(task, context);
      await this.sendDomainEvents(task);
    });
  }

  async authorize(command: CreateTask_Command) {
    return !!command.requesterUserId;
  }

  async validate(command: CreateTask_Command) {
    // The local user projection is load-bearing: tasks may only belong to
    // accounts this context knows about (built from the UserCreated events),
    // so a token for a user the projection has not seen yet is rejected.
    const userExists = await this.userRepository.exists(new Id(command.requesterUserId!));
    if (!userExists) {
      throw new NotFoundException('User', command.requesterUserId!);
    }
  }
}
