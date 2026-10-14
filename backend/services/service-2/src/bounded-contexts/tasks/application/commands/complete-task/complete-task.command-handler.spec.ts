import { ForbiddenException, Id, MockEventBus, NotFoundException } from '@libs/nestjs-common';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { CompleteTask_Command } from './complete-task.command';
import { CompleteTask_CommandHandler } from './complete-task.command-handler';

describe('CompleteTask_CommandHandler', () => {
  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const taskRepository = new Task_InMemoryRepository(params.shouldFailRepository);
    const eventBus = new MockEventBus();
    const handler = new CompleteTask_CommandHandler(taskRepository, eventBus);
    return { taskRepository, handler };
  };

  it('marks the owner’s task as completed', async () => {
    const { handler, taskRepository } = setup();
    const owner = Id.random();
    const task = Task.random({ userId: owner, completed: false });
    await taskRepository.save(task);

    await handler.execute(
      new CompleteTask_Command({ taskId: task.id.toValue(), requesterUserId: owner.toValue() }),
    );

    const stored = await taskRepository.findById(task.id);
    expect(stored!.completed).toBe(true);
  });

  it('rejects when the requester does not own the task, leaving it unchanged', async () => {
    const { handler, taskRepository } = setup();
    const task = Task.random({ completed: false });
    await taskRepository.save(task);

    await expect(
      handler.execute(
        new CompleteTask_Command({
          taskId: task.id.toValue(),
          requesterUserId: Id.random().toValue(),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    const stored = await taskRepository.findById(task.id);
    expect(stored!.completed).toBe(false);
  });

  it('throws NotFound for an unknown task id', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(
        new CompleteTask_Command({
          taskId: Id.random().toValue(),
          requesterUserId: Id.random().toValue(),
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates repository failures', async () => {
    const { handler } = setup({ shouldFailRepository: true });

    await expect(
      handler.execute(
        new CompleteTask_Command({
          taskId: Id.random().toValue(),
          requesterUserId: Id.random().toValue(),
        }),
      ),
    ).rejects.toThrow();
  });
});
