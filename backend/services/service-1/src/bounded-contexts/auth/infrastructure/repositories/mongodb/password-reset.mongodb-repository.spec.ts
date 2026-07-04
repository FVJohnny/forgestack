import { PasswordReset_MongodbRepository } from './password-reset.mongodb-repository';
import { testPasswordResetRepositoryContract } from '@bc/auth/domain/aggregates/password-reset/password-reset.repository.spec';
import { MongodbTestService } from '@libs/nestjs-mongodb';
import type { PasswordResetDTO } from '@bc/auth/domain/aggregates/password-reset/password-reset.dto';

describe('PasswordResetMongodbRepository (Integration)', () => {
  const mongoTestService = new MongodbTestService<PasswordResetDTO>(
    PasswordReset_MongodbRepository.CollectionName,
  );

  testPasswordResetRepositoryContract(
    'MongoDB Implementation',
    async () => new PasswordReset_MongodbRepository(mongoTestService.mongoClient),
    {
      beforeAll: () => mongoTestService.setupDatabase(),
      beforeEach: () => mongoTestService.clearCollection(),
      afterAll: () => mongoTestService.cleanup(),
    },
  );
});
