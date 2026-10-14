import { Id, Timestamps, DateVO } from '@libs/nestjs-common';
import { Task_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/task.in-memory-repository';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { ListTasks_Query } from './list-tasks.query';
import { LIST_TASKS_LIMIT, ListTasks_QueryHandler } from './list-tasks.query-handler';

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
    expect(result.open).toBe(0);
    expect(result.limit).toBe(LIST_TASKS_LIMIT);
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
    expect(result.open).toBe(2);
  });

  it('counts only the user’s open tasks', async () => {
    const { handler, taskRepository } = setup();
    const me = Id.random();
    await taskRepository.save(Task.random({ userId: me, completed: false }));
    await taskRepository.save(Task.random({ userId: me, completed: true }));
    await taskRepository.save(Task.random({ completed: false }));

    const result = await handler.execute(new ListTasks_Query({ userId: me.toValue() }));

    expect(result.total).toBe(2);
    expect(result.open).toBe(1);
  });

  it('caps the list but counts total and open over every task', async () => {
    const { handler, taskRepository } = setup();
    const me = Id.random();
    // Open tasks are the oldest, so they all fall outside the capped page: a
    // count derived from the returned page would report 0 open.
    for (let i = 0; i < 5; i++) {
      await taskRepository.save(
        Task.random({
          userId: me,
          completed: false,
          timestamps: at(`2026-01-01T00:00:0${i}.000Z`),
        }),
      );
    }
    for (let i = 0; i < LIST_TASKS_LIMIT; i++) {
      await taskRepository.save(
        Task.random({ userId: me, completed: true, timestamps: at('2026-02-01T00:00:00.000Z') }),
      );
    }

    const result = await handler.execute(new ListTasks_Query({ userId: me.toValue() }));

    expect(result.tasks).toHaveLength(LIST_TASKS_LIMIT);
    expect(result.tasks.every((task) => task.completed)).toBe(true);
    expect(result.total).toBe(LIST_TASKS_LIMIT + 5);
    expect(result.open).toBe(5);
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
