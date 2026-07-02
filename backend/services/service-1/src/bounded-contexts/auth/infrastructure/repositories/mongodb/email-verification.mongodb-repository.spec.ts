import { EmailVerification_MongodbRepository } from './email-verification.mongodb-repository';
import { testEmailVerificationRepositoryContract } from '@bc/auth/domain/aggregates/email-verification/email-verification.repository.spec';
import { MongodbTestService } from '@libs/nestjs-mongodb';
import type { EmailVerificationDTO } from '@bc/auth/domain/aggregates/email-verification/email-verification.dto';

describe('EmailVerificationMongodbRepository (Integration)', () => {
  const mongoTestService = new MongodbTestService<EmailVerificationDTO>(
    EmailVerification_MongodbRepository.CollectionName,
  );

  testEmailVerificationRepositoryContract(
    'MongoDB Implementation',
    async () => new EmailVerification_MongodbRepository(mongoTestService.mongoClient),
    {
      beforeAll: () => mongoTestService.setupDatabase(),
      beforeEach: () => mongoTestService.clearCollection(),
      afterAll: () => mongoTestService.cleanup(),
    },
  );
});
