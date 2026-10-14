import { Id, MockEventBus } from '@libs/nestjs-common';
import { User_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/user.in-memory-repository';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { User } from '@bc/tasks/domain/aggregates/user/user.aggregate';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { DeleteUser_Command } from './delete-user.command';
import { DeleteUser_CommandHandler } from './delete-user.command-handler';

describe('DeleteUser_CommandHandler (tasks cascade)', () => {
  const setup = () => {
    const userRepository = new User_InMemoryRepository();
    const taskRepository = new Task_InMemoryRepository();
    const eventBus = new MockEventBus();
    const handler = new DeleteUser_CommandHandler(userRepository, taskRepository, eventBus);
    return { userRepository, taskRepository, handler };
  };

  it('removes the user projection and every task the user owned', async () => {
    const { handler, userRepository, taskRepository } = setup();
    const user = User.random();
    await userRepository.save(user);
    await taskRepository.save(Task.random({ userId: user.id }));
    await taskRepository.save(Task.random({ userId: user.id }));

    await handler.execute(new DeleteUser_Command(user.id.toValue()));

    expect(await userRepository.findById(user.id)).toBeNull();
    expect(await taskRepository.findAll()).toHaveLength(0);
  });

  it('leaves other users and their tasks untouched', async () => {
    const { handler, userRepository, taskRepository } = setup();
    const doomed = User.random();
    const survivor = User.random();
    await userRepository.save(doomed);
    await userRepository.save(survivor);
    await taskRepository.save(Task.random({ userId: doomed.id }));
    const survivorTask = Task.random({ userId: survivor.id });
    await taskRepository.save(survivorTask);

    await handler.execute(new DeleteUser_Command(doomed.id.toValue()));

    expect(await userRepository.findById(survivor.id)).not.toBeNull();
    const remaining = await taskRepository.findAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id.equals(survivorTask.id)).toBe(true);
  });

  it('is safe to run for a user this context never saw (redelivery)', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(new DeleteUser_Command(Id.random().toValue())),
    ).resolves.not.toThrow();
  });
});
