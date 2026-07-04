import { VerifyEmail_CommandHandler } from './verify-email.command-handler';
import { VerifyEmail_Command } from './verify-email.command';
import { EmailVerification_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/email-verification.in-memory-repository';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { Expiration } from '@bc/auth/domain/value-objects';
import {
  ApplicationException,
  DomainValidationException,
  Id,
  MockEventBus,
  InfrastructureException,
  InvalidOperationException,
  NotFoundException,
  Outbox_InMemoryRepository,
  EmailVerified_IntegrationEvent,
} from '@libs/nestjs-common';
import type { EmailVerificationVerified_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verified.domain-event';

describe('VerifyEmailCommandHandler', () => {
  // Test data factory
  const createCommand = (props?: { emailVerificationId?: string }) => {
    return new VerifyEmail_Command({
      emailVerificationId: props?.emailVerificationId || Id.random().toValue(),
    });
  };

  // Setup factory
  const setup = async (
    params: {
      withEmailVerification?: boolean;
      type?: 'pending' | 'expired' | 'verified';
      shouldFailRepository?: boolean;
      shouldFailEventBus?: boolean;
      shouldFailOutbox?: boolean;
    } = {},
  ) => {
    const {
      withEmailVerification = false,
      type = 'pending',
      shouldFailRepository = false,
      shouldFailEventBus = false,
      shouldFailOutbox = false,
    } = params;

    const repository = new EmailVerification_InMemoryRepository(shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const outboxRepository = new Outbox_InMemoryRepository(shouldFailOutbox);
    const commandHandler = new VerifyEmail_CommandHandler(repository, eventBus, outboxRepository);

    let emailVerification: EmailVerification | null = null;
    if (withEmailVerification) {
      emailVerification = EmailVerification.random({
        expiration: Expiration.atHoursFromNow(type === 'expired' ? -1 : 24),
      });

      if (type === 'verified') {
        emailVerification.verify();
      }

      await repository.save(emailVerification);
    }

    return { repository, eventBus, outboxRepository, commandHandler, emailVerification };
  };

  describe('Happy Path', () => {
    it('should successfully verify email with valid ID', async () => {
      // Arrange
      const { commandHandler, repository, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'pending',
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act
      await commandHandler.execute(command);

      // Verify the email verification is now verified
      const verifiedEmail = await repository.findById(emailVerification!.id);
      expect(verifiedEmail).not.toBeNull();
      expect(verifiedEmail!.isVerified()).toBe(true);
      expect(verifiedEmail!.isPending()).toBe(false);
    });
  });

  describe('Domain Events', () => {
    it('should publish domain events when email is verified', async () => {
      // Arrange
      const { commandHandler, eventBus, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'pending',
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act
      await commandHandler.execute(command);

      // Assert
      expect(eventBus.events).toHaveLength(1);
      const event = eventBus.events[0] as EmailVerificationVerified_DomainEvent;

      expect(event.aggregateId.toValue()).toBe(emailVerification!.id.toValue());
      expect(event.userId.toValue()).toBe(emailVerification!.userId.toValue());
      expect(event.email.toValue()).toBe(emailVerification!.email.toValue());
      expect(event.occurredOn).toBeInstanceOf(Date);
    });
  });

  describe('Integration Events', () => {
    it('should store integration event in the outbox', async () => {
      // Arrange
      const { commandHandler, outboxRepository, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'pending',
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act
      await commandHandler.execute(command);

      // Assert
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(1);

      const event = EmailVerified_IntegrationEvent.fromJSON(outboxEvents[0].payload.toJSON());
      expect(event.id).toBeDefined();
      expect(event.email).toBe(emailVerification!.email.toValue());
      expect(event.userId).toBe(emailVerification!.userId.toValue());
      expect(event.emailVerificationId).toBe(emailVerification!.id.toValue());
      expect(event.occurredOn).toBeInstanceOf(Date);
    });

    it('should propagate failures when storing the integration event in the Outbox fails', async () => {
      // Arrange
      const { commandHandler, repository, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'pending',
        shouldFailOutbox: true,
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);

      // Verify transaction rollback: the verification should still be pending
      const verification = await repository.findById(emailVerification!.id);
      expect(verification).not.toBeNull();
      expect(verification!.isVerified()).toBe(false);
      expect(verification!.isPending()).toBe(true);
    });
  });

  describe('Error Cases', () => {
    it('should throw DomainValidationException for malformed ID', async () => {
      // Arrange
      const { commandHandler } = await setup();
      const command = createCommand({
        emailVerificationId: '!!!invalid-id-format!!!',
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw NotFoundException when ID does not exist', async () => {
      // Arrange
      const { commandHandler } = await setup();
      const command = createCommand();

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw InvalidOperationException when email verification is expired', async () => {
      // Arrange
      const { commandHandler, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'expired',
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InvalidOperationException);
    });

    it('should throw InvalidOperationException when email is already verified', async () => {
      // Arrange
      const { commandHandler, emailVerification } = await setup({
        withEmailVerification: true,
        type: 'verified',
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InvalidOperationException);
    });

    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { commandHandler } = await setup({ shouldFailRepository: true });
      const command = createCommand();

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should propagate event bus exceptions', async () => {
      // Arrange
      const { commandHandler, repository, outboxRepository, emailVerification } = await setup({
        withEmailVerification: true,
        shouldFailEventBus: true,
      });
      const command = createCommand({
        emailVerificationId: emailVerification!.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(ApplicationException);

      // Verify transaction rollback: the verification should still be pending
      const verification = await repository.findById(emailVerification!.id);
      expect(verification!.isVerified()).toBe(false);
      expect(verification!.isPending()).toBe(true);

      // Verify that the integration event was not stored in the Outbox
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(0);
    });
  });
});
