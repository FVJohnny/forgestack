import { ForbiddenException, Id, MockEventBus, NotFoundException } from '@libs/nestjs-common';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { DeleteTask_Command } from './delete-task.command';
import { DeleteTask_CommandHandler } from './delete-task.command-handler';

describe('DeleteTask_CommandHandler', () => {
  const setup = () => {
    const taskRepository = new Task_InMemoryRepository();
    const eventBus = new MockEventBus();
    const handler = new DeleteTask_CommandHandler(taskRepository, eventBus);
    return { taskRepository, handler };
  };

  it('deletes the owner’s task and nobody else’s', async () => {
    const { handler, taskRepository } = setup();
    const owner = Id.random();
    const mine = Task.random({ userId: owner });
    const theirs = Task.random();
    await taskRepository.save(mine);
    await taskRepository.save(theirs);

    await handler.execute(
      new DeleteTask_Command({ taskId: mine.id.toValue(), requesterUserId: owner.toValue() }),
    );

    expect(await taskRepository.findById(mine.id)).toBeNull();
    expect(await taskRepository.findById(theirs.id)).not.toBeNull();
  });

  it('rejects when the requester does not own the task', async () => {
    const { handler, taskRepository } = setup();
    const task = Task.random();
    await taskRepository.save(task);

    await expect(
      handler.execute(
        new DeleteTask_Command({
          taskId: task.id.toValue(),
          requesterUserId: Id.random().toValue(),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(await taskRepository.findById(task.id)).not.toBeNull();
  });

  it('throws NotFound for an unknown task id', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(
        new DeleteTask_Command({
          taskId: Id.random().toValue(),
          requesterUserId: Id.random().toValue(),
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
