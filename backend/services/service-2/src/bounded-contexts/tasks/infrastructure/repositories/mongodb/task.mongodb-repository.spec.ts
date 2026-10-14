import { Task_MongodbRepository } from './task.mongodb-repository';
import { testTaskRepositoryContract } from '@bc/tasks/domain/aggregates/task/task.repository.spec';
import { MongodbTestService } from '@libs/nestjs-mongodb';
import type { TaskDTO } from '@bc/tasks/domain/aggregates/task/task.dto';

describe('TaskMongodbRepository (Integration)', () => {
  const mongoTestService = new MongodbTestService<TaskDTO>(Task_MongodbRepository.CollectionName);

  testTaskRepositoryContract(
    'MongoDB Implementation',
    async () => new Task_MongodbRepository(mongoTestService.mongoClient),
    {
      beforeAll: () => mongoTestService.setupDatabase(),
      beforeEach: () => mongoTestService.clearCollection(),
      afterAll: () => mongoTestService.cleanup(),
    },
  );
});
