import { User_MongodbRepository } from './user.mongodb-repository';
import { testUserRepositoryContract } from '@bc/auth/domain/aggregates/user/user.repository.spec';
import { MongodbTestService } from '@libs/nestjs-mongodb';
import type { UserDTO } from '@bc/auth/domain/aggregates/user/user.dto';

describe('UserMongodbRepository (Integration)', () => {
  const mongoTestService = new MongodbTestService<UserDTO>(User_MongodbRepository.CollectionName);

  testUserRepositoryContract(
    'MongoDB Implementation',
    async () => new User_MongodbRepository(mongoTestService.mongoClient),
    {
      beforeAll: () => mongoTestService.setupDatabase(),
      beforeEach: () => mongoTestService.clearCollection(),
      afterAll: () => mongoTestService.cleanup(),
    },
  );
});
