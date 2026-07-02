import { testEmailServiceContract } from '@bc/notifications/domain/services/email.service.spec';
import { Email_InMemoryService } from './email.in-memory-service';

describe('Email_InMemoryService', () => {
  testEmailServiceContract('In-Memory Implementation', (shouldFail = false) => {
    return new Email_InMemoryService(shouldFail);
  });
});
