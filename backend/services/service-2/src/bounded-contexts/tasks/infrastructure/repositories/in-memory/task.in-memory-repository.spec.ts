import { Task_InMemoryRepository } from './task.in-memory-repository';
import { testTaskRepositoryContract } from '@bc/tasks/domain/aggregates/task/task.repository.spec';

describe('TaskInMemoryRepository', () => {
  testTaskRepositoryContract('In-Memory Implementation', async () => {
    return new Task_InMemoryRepository();
  });
});
