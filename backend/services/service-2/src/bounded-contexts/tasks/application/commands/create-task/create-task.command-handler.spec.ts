import { ForbiddenException, Id, MockEventBus, NotFoundException } from '@libs/nestjs-common';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { User_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/tasks/domain/aggregates/user/user.aggregate';
import { CreateTask_Command } from './create-task.command';
import { CreateTask_CommandHandler } from './create-task.command-handler';

describe('CreateTask_CommandHandler', () => {
  const setup = (params: { withUser?: boolean; shouldFailRepository?: boolean } = {}) => {
    const taskRepository = new Task_InMemoryRepository(params.shouldFailRepository);
    const userRepository = new User_InMemoryRepository();
    const eventBus = new MockEventBus();
    const handler = new CreateTask_CommandHandler(taskRepository, userRepository, eventBus);

    let user: User | null = null;
    if (params.withUser !== false) {
      user = User.random();
      void userRepository.save(user);
    }

    return { taskRepository, userRepository, handler, user };
  };

  it('persists an uncompleted task owned by the requester', async () => {
    const { handler, taskRepository, user } = setup();
    const command = new CreateTask_Command({
      title: 'Water the plants',
      requesterUserId: user!.id.toValue(),
    });

    await handler.execute(command);

    const tasks = await taskRepository.findAll();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].userId.toValue()).toBe(user!.id.toValue());
    expect(tasks[0].title.toValue()).toBe('Water the plants');
    expect(tasks[0].completed).toBe(false);
  });

  it('rejects when the user is not in the local projection (load-bearing check)', async () => {
    const { handler, taskRepository } = setup({ withUser: false });
    const command = new CreateTask_Command({
      title: 'Ghost task',
      requesterUserId: Id.random().toValue(),
    });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(await taskRepository.findAll()).toHaveLength(0);
  });

  it('rejects when there is no requester', async () => {
    const { handler } = setup();
    const command = new CreateTask_Command({
      title: 'Anonymous task',
      requesterUserId: undefined as unknown as string,
    });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('propagates repository failures', async () => {
    const { handler, user } = setup({ shouldFailRepository: true });
    const command = new CreateTask_Command({
      title: 'Doomed task',
      requesterUserId: user!.id.toValue(),
    });

    await expect(handler.execute(command)).rejects.toThrow();
  });
});
