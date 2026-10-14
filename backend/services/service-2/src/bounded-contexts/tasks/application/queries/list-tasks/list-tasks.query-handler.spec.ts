import { Id, Timestamps, DateVO } from '@libs/nestjs-common';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { ListTasks_Query } from './list-tasks.query';
import { ListTasks_QueryHandler } from './list-tasks.query-handler';

describe('ListTasks_QueryHandler', () => {
  const setup = () => {
    const taskRepository = new Task_InMemoryRepository();
    const handler = new ListTasks_QueryHandler(taskRepository);
    return { taskRepository, handler };
  };

  const at = (iso: string) => new Timestamps(new DateVO(new Date(iso)), new DateVO(new Date(iso)));

  it('returns an empty list when the user has no tasks', async () => {
    const { handler } = setup();

    const result = await handler.execute(new ListTasks_Query({ userId: Id.random().toValue() }));

    expect(result.tasks).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns only the querying user’s tasks', async () => {
    const { handler, taskRepository } = setup();
    const me = Id.random();
    await taskRepository.save(Task.random({ userId: me }));
    await taskRepository.save(Task.random({ userId: me }));
    await taskRepository.save(Task.random());

    const result = await handler.execute(new ListTasks_Query({ userId: me.toValue() }));

    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('orders newest first and serializes dates as ISO strings', async () => {
    const { handler, taskRepository } = setup();
    const me = Id.random();
    await taskRepository.save(
      Task.random({ userId: me, timestamps: at('2026-01-01T10:00:00.000Z') }),
    );
    await taskRepository.save(
      Task.random({ userId: me, timestamps: at('2026-01-02T10:00:00.000Z') }),
    );

    const result = await handler.execute(new ListTasks_Query({ userId: me.toValue() }));

    expect(result.tasks[0].createdAt).toBe('2026-01-02T10:00:00.000Z');
    expect(result.tasks[1].createdAt).toBe('2026-01-01T10:00:00.000Z');
    expect(typeof result.tasks[0].completed).toBe('boolean');
  });
});
