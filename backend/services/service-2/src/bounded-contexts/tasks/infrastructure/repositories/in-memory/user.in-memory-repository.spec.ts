import { User_InMemoryRepository } from './user.in-memory-repository';
import { testUserRepositoryContract } from '@bc/tasks/domain/aggregates/user/user.repository.spec';

describe('UserInMemoryRepository (tasks projection)', () => {
  testUserRepositoryContract('In-Memory Implementation', async () => {
    return new User_InMemoryRepository();
  });
});
