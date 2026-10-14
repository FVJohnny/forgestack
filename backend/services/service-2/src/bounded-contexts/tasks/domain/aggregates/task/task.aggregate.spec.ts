import { Id } from '@libs/nestjs-common';
import { TaskTitle } from '@bc/tasks/domain/value-objects';
import { Task } from './task.aggregate';

describe('Task aggregate', () => {
  it('create() starts uncompleted with the given owner and title', () => {
    const userId = Id.random();
    const title = new TaskTitle('Ship the release');

    const task = Task.create({ userId, title });

    expect(task.completed).toBe(false);
    expect(task.userId.equals(userId)).toBe(true);
    expect(task.title.toValue()).toBe('Ship the release');
  });

  it('complete() and uncomplete() flip the flag', () => {
    const task = Task.random({ completed: false });

    task.complete();
    expect(task.completed).toBe(true);

    task.uncomplete();
    expect(task.completed).toBe(false);
  });

  it('isOwnedBy() matches only the owner', () => {
    const owner = Id.random();
    const task = Task.random({ userId: owner });

    expect(task.isOwnedBy(owner)).toBe(true);
    expect(task.isOwnedBy(Id.random())).toBe(false);
  });

  it('toValue()/fromValue() round-trip preserves every field', () => {
    const task = Task.random({ completed: true });

    const restored = Task.fromValue(task.toValue());

    expect(restored.id.equals(task.id)).toBe(true);
    expect(restored.userId.equals(task.userId)).toBe(true);
    expect(restored.title.toValue()).toBe(task.title.toValue());
    expect(restored.completed).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(() => new TaskTitle('   ')).toThrow();
  });

  it('rejects a title over the maximum length', () => {
    expect(() => new TaskTitle('x'.repeat(201))).toThrow();
  });
});
