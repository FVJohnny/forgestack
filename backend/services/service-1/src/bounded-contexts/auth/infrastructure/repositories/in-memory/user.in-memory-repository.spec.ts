import { User_InMemoryRepository } from './user.in-memory-repository';
import { testUserRepositoryContract } from '@bc/auth/domain/aggregates/user/user.repository.spec';

describe('UserInMemoryRepository', () => {
  testUserRepositoryContract('In-Memory Implementation', async () => {
    return new User_InMemoryRepository();
  });
});
