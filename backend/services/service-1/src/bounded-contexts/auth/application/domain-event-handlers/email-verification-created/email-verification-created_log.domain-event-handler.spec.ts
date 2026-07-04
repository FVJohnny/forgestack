import { EmailVerificationCreated_Log_DomainEventHandler } from './email-verification-created_log.domain-event-handler';
import { EmailVerificationCreated_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verification-created.domain-event';
import { Id } from '@libs/nestjs-common';
import { Email, Expiration } from '@bc/auth/domain/value-objects';

describe('EmailVerificationCreated_Log_DomainEventHandler', () => {
  let handler: EmailVerificationCreated_Log_DomainEventHandler;

  beforeEach(() => {
    handler = new EmailVerificationCreated_Log_DomainEventHandler();
  });

  describe('handle', () => {
    it('should handle EmailVerificationCreatedDomainEvent', async () => {
      // Arrange
      const event = new EmailVerificationCreated_DomainEvent(
        Id.random(),
        Id.random(),
        Email.random(),
        Expiration.atHoursFromNow(24),
      );

      // Act
      await handler.handle(event);

      // Assert
      // Since the handler only logs for now, we just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});
