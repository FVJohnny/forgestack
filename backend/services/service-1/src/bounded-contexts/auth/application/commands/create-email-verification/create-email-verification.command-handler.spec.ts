import { CreateEmailVerification_CommandHandler } from './create-email-verification.command-handler';
import { CreateEmailVerification_Command } from './create-email-verification.command';
import { EmailVerification_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/email-verification.in-memory-repository';
import {
  ApplicationException,
  AlreadyExistsException,
  InfrastructureException,
  MockEventBus,
  Outbox_InMemoryRepository,
  EmailVerificationCreated_IntegrationEvent,
} from '@libs/nestjs-common';
import { EmailVerificationCreated_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verification-created.domain-event';
import { Id } from '@libs/nestjs-common';
import { Email, Expiration } from '@bc/auth/domain/value-objects';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';

describe('CreateEmailVerificationCommandHandler', () => {
  // Test data factory
  const createCommand = ({
    userId,
    email,
    emailAlreadyVerified,
  }: {
    userId?: string;
    email?: string;
    emailAlreadyVerified?: boolean;
  }) =>
    new CreateEmailVerification_Command({
      userId: userId || Id.random().toValue(),
      email: email || Email.random().toValue(),
      emailAlreadyVerified,
    });

  // Setup factory
  const setup = async (
    params: {
      withExistingVerification?: boolean;
      withExistingUser?: boolean;
      shouldFailRepository?: boolean;
      shouldFailEventBus?: boolean;
      shouldFailOutbox?: boolean;
    } = {},
  ) => {
    const {
      withExistingVerification = false,
      withExistingUser = false,
      shouldFailRepository = false,
      shouldFailEventBus = false,
      shouldFailOutbox = false,
    } = params;

    const emailVerificationRepository = new EmailVerification_InMemoryRepository(
      shouldFailRepository,
    );
    const userRepository = new User_InMemoryRepository(shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const outboxRepository = new Outbox_InMemoryRepository(shouldFailOutbox);
    const commandHandler = new CreateEmailVerification_CommandHandler(
      emailVerificationRepository,
      userRepository,
      eventBus,
      outboxRepository,
    );

    let user: User | null = null;
    if (withExistingUser) {
      user = User.random();
      await userRepository.save(user);
    }

    let emailVerification: EmailVerification | null = null;
    if (withExistingVerification) {
      emailVerification = EmailVerification.random({
        userId: user!.id || Id.random(),
        email: user!.email || Email.random(),
      });
      await emailVerificationRepository.save(emailVerification);
    }

    return {
      repository: emailVerificationRepository,
      userRepository,
      eventBus,
      outboxRepository,
      commandHandler,
      emailVerification,
      user,
    };
  };

  describe('Happy Path', () => {
    it('should successfully create email verification with valid data', async () => {
      // Arrange
      const { commandHandler, repository, user } = await setup({ withExistingUser: true });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act
      await commandHandler.execute(command);

      // Verify email verification was saved
      const savedVerification = await repository.findByUserId(new Id(command.userId));
      expect(savedVerification).not.toBeNull();
      expect(savedVerification!.userId.toValue()).toBe(command.userId);
      expect(savedVerification!.email.toValue()).toBe(command.email);
      expect(savedVerification!.isVerified()).toBe(false);
      expect(savedVerification!.isPending()).toBe(true);
    });

    it('should set expiration date 24 hours from creation', async () => {
      // Arrange
      const { commandHandler, repository, user } = await setup({ withExistingUser: true });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act
      await commandHandler.execute(command);

      // Assert
      const verification = await repository.findByUserId(new Id(command.userId));
      expect(verification).not.toBeNull();

      const expectedExpiration = Expiration.atHoursFromNow(24);
      const actualExpiration = verification!.expiration;

      // Allow for small time differences in test execution
      expect(actualExpiration.isWithinTolerance(expectedExpiration.toValue(), 5000)).toBe(true);
    });
  });

  describe('Domain Events', () => {
    it('should publish EmailVerificationCreatedDomainEvent', async () => {
      // Arrange
      const { commandHandler, eventBus, user } = await setup({ withExistingUser: true });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act
      await commandHandler.execute(command);

      // Assert
      expect(eventBus.events).toHaveLength(1);
      const event = eventBus.events[0] as EmailVerificationCreated_DomainEvent;
      expect(event).toBeInstanceOf(EmailVerificationCreated_DomainEvent);
      expect(event.aggregateId.toValue()).toBeDefined();
      expect(event.userId.toValue()).toBe(command.userId);
      expect(event.email.toValue()).toBe(command.email);
      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.expiration).toBeInstanceOf(Expiration);
    });
  });

  describe('Integration Events', () => {
    it('should store integration event in the outbox', async () => {
      // Arrange
      const { commandHandler, outboxRepository, repository, user } = await setup({
        withExistingUser: true,
      });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act
      await commandHandler.execute(command);

      // Assert - Expect 2 events: EmailVerificationCreated and UserCreated
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(2);

      // Find the EmailVerificationCreated event
      const emailVerificationEvent = outboxEvents.find(
        (e) => e.eventName.toValue() === 'email-verification.created',
      );
      expect(emailVerificationEvent).toBeDefined();

      const event = EmailVerificationCreated_IntegrationEvent.fromJSON(
        emailVerificationEvent!.payload.toJSON(),
      );
      expect(event.id).toBeDefined();
      expect(event.email).toBe(command.email);
      expect(event.userId).toBe(command.userId);
      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.expiresAt).toBeInstanceOf(Date);

      // Verify the event's emailVerificationId matches the created verification
      const savedVerification = await repository.findByUserId(new Id(command.userId));
      expect(event.emailVerificationId).toBe(savedVerification!.id.toValue());
    });

    it('should propagate failures when storing the integration event in the Outbox fails', async () => {
      // Arrange
      const { commandHandler, repository, user } = await setup({
        withExistingUser: true,
        shouldFailOutbox: true,
      });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
      // Verify that the verification was not created (Transaction)
      const verification = await repository.findByUserId(new Id(command.userId));
      expect(verification).toBeNull();
    });
  });

  describe('Pre-verified (Google OAuth) Path', () => {
    it('should NOT create an email verification when email is already verified', async () => {
      // Arrange
      const { commandHandler, repository, user } = await setup({ withExistingUser: true });
      const command = createCommand({
        userId: user!.id.toValue(),
        email: user!.email.toValue(),
        emailAlreadyVerified: true,
      });

      // Act
      await commandHandler.execute(command);

      // Assert — no "verify your email" verification created
      const savedVerification = await repository.findByUserId(new Id(command.userId));
      expect(savedVerification).toBeNull();
    });

    it('should emit EmailVerified (welcome) and UserCreated, but NOT EmailVerificationCreated', async () => {
      // Arrange
      const { commandHandler, outboxRepository, user } = await setup({ withExistingUser: true });
      const command = createCommand({
        userId: user!.id.toValue(),
        email: user!.email.toValue(),
        emailAlreadyVerified: true,
      });

      // Act
      await commandHandler.execute(command);

      // Assert
      const outboxEvents = await outboxRepository.findAll();
      const eventNames = outboxEvents.map((e) => e.eventName.toValue());

      expect(eventNames).toContain('email.verified');
      expect(eventNames).toContain('user.created');
      expect(eventNames).not.toContain('email-verification.created');
    });

    it('should skip uniqueness validation even if a verification already exists', async () => {
      // Arrange — an existing verification would normally trigger AlreadyExistsException
      const { commandHandler, emailVerification } = await setup({
        withExistingUser: true,
        withExistingVerification: true,
      });
      const command = createCommand({
        userId: emailVerification!.userId.toValue(),
        email: emailVerification!.email.toValue(),
        emailAlreadyVerified: true,
      });

      // Act & Assert — does not throw
      await expect(commandHandler.execute(command)).resolves.not.toThrow();
    });
  });

  describe('Error Cases', () => {
    it('should throw AlreadyExistsException when EmailVerification already exists with the same email', async () => {
      // Arrange
      const { commandHandler, userRepository, emailVerification } = await setup({
        withExistingUser: true,
        withExistingVerification: true,
      });

      const user = User.random();
      await userRepository.save(user);

      const command = createCommand({
        email: emailVerification!.email.toValue(),
        userId: user.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(AlreadyExistsException);
    });

    it('should throw AlreadyExistsException when EmailVerification already exists with the same userId', async () => {
      // Arrange
      const { commandHandler, emailVerification } = await setup({
        withExistingUser: true,
        withExistingVerification: true,
      });
      const command = createCommand({
        userId: emailVerification!.userId.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(AlreadyExistsException);
    });

    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { commandHandler } = await setup({ shouldFailRepository: true });
      const command = createCommand({});

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should propagate event bus exceptions', async () => {
      // Arrange
      const { commandHandler, repository, outboxRepository, user } = await setup({
        withExistingUser: true,
        shouldFailEventBus: true,
      });
      const command = createCommand({ userId: user!.id.toValue(), email: user!.email.toValue() });

      // Act & Assert
      // Since domain events are sent during command execution, this should fail
      await expect(commandHandler.execute(command)).rejects.toThrow(ApplicationException);
      // Verify that the verification was not created (Transaction)
      const verification = await repository.findByUserId(new Id(command.userId));
      expect(verification).toBeNull();
      // Verify that the integration event was not stored in the Outbox
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(0);
    });
  });
});
