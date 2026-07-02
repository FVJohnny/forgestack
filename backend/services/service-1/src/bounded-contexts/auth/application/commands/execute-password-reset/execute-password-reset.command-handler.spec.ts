import { ExecutePasswordReset_CommandHandler } from './execute-password-reset.command-handler';
import { ExecutePasswordReset_Command } from './execute-password-reset.command';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { PasswordReset_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/password-reset.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import {
  ApplicationException,
  DateVO,
  InfrastructureException,
  MockEventBus,
  NotFoundException,
  InvalidOperationException,
  wait,
  Outbox_InMemoryRepository,
  PasswordResetCompleted_IntegrationEvent,
} from '@libs/nestjs-common';
import { UserPasswordChanged_DomainEvent } from '@bc/auth/domain/aggregates/user/events/password-changed.domain-event';
import { UserLogout_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-logout.domain-event';
import { PasswordResetUniquenessChecker_Mock } from '@bc/auth/domain/services/password-reset-uniqueness-checker.mock';

describe('ExecutePasswordResetCommandHandler', () => {
  // Test data factory
  const createCommand = (props?: Partial<ExecutePasswordReset_Command>) =>
    new ExecutePasswordReset_Command(
      props?.passwordResetId || PasswordReset.random().id.toValue(),
      props?.newPassword || 'NewSecurePassword123!',
    );

  const createPasswordReset = async (
    passwordResetRepository: PasswordReset_InMemoryRepository,
    email: Email,
    isValid: boolean = true,
  ) => {
    const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();
    const passwordReset = await PasswordReset.create({ email }, passwordResetUniquenessChecker);
    if (!isValid) {
      passwordReset.expiration = Expiration.atHoursFromNow(-1); // Expired
    }
    await passwordResetRepository.save(passwordReset);
    return passwordReset;
  };

  // Setup factory
  const setup = async (
    params: {
      shouldFailPasswordResetRepository?: boolean;
      shouldFailUserRepository?: boolean;
      shouldFailEventBus?: boolean;
      shouldFailOutbox?: boolean;
      withUser?: boolean;
    } = {},
  ) => {
    const {
      shouldFailPasswordResetRepository = false,
      shouldFailUserRepository = false,
      shouldFailEventBus = false,
      shouldFailOutbox = false,
      withUser = false,
    } = params;

    const userRepository = new User_InMemoryRepository(shouldFailUserRepository);
    const passwordResetRepository = new PasswordReset_InMemoryRepository(
      shouldFailPasswordResetRepository,
    );
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const outboxRepository = new Outbox_InMemoryRepository(shouldFailOutbox);
    const commandHandler = new ExecutePasswordReset_CommandHandler(
      userRepository,
      passwordResetRepository,
      eventBus,
      outboxRepository,
    );

    let user: User | null = null;
    if (withUser) {
      user = User.random();
      await userRepository.save(user);
    }

    return {
      userRepository,
      passwordResetRepository,
      eventBus,
      outboxRepository,
      commandHandler,
      user,
    };
  };

  describe('Happy Path', () => {
    it('should successfully reset password for a valid password reset', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const oldPasswordHash = user!.password.toValue();
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword: 'NewSecurePassword123!',
      });

      // Act
      await commandHandler.execute(command);

      // Assert - Verify password was changed
      const updatedUser = await userRepository.findById(user!.id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.password.toValue()).not.toBe(oldPasswordHash);

      // Verify password reset was marked as used
      const updatedPasswordReset = await passwordResetRepository.findById(passwordReset.id);
      expect(updatedPasswordReset).not.toBeNull();
      expect(updatedPasswordReset!.isUsed()).toBe(true);
    });

    it('should publish PasswordChangedEvent after password reset', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository, eventBus, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword: 'NewSecurePassword123!',
      });

      // Act
      await commandHandler.execute(command);

      // Assert - Check the events were published
      expect(eventBus.events).toBeDefined();
      expect(eventBus.events).toHaveLength(2);

      const passwordChangedEvent = eventBus.events[0] as UserPasswordChanged_DomainEvent;
      expect(passwordChangedEvent).toBeInstanceOf(UserPasswordChanged_DomainEvent);
      expect(passwordChangedEvent.email.toValue()).toBe(user!.email.toValue());
      expect(passwordChangedEvent.occurredOn).toBeInstanceOf(Date);

      const logoutEvent = eventBus.events[1];
      expect(logoutEvent).toBeInstanceOf(UserLogout_DomainEvent);
      expect(logoutEvent.occurredOn).toBeInstanceOf(Date);
    });

    it('should update timestamps on password change', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword: 'NewSecurePassword123!',
      });
      const beforeChange = DateVO.now();
      await wait(10);

      // Act
      await commandHandler.execute(command);
      await wait(10);
      const afterChange = DateVO.now();

      // Assert - User timestamps
      const updatedUser = await userRepository.findById(user!.id);
      expect(updatedUser!.timestamps.updatedAt.isAfter(beforeChange)).toBe(true);
      expect(updatedUser!.timestamps.updatedAt.isBefore(afterChange)).toBe(true);

      // Assert - Password reset timestamps
      const updatedPasswordReset = await passwordResetRepository.findById(passwordReset.id);
      expect(updatedPasswordReset!.timestamps.updatedAt.isAfter(beforeChange)).toBe(true);
      expect(updatedPasswordReset!.timestamps.updatedAt.isBefore(afterChange)).toBe(true);
    });

    it('should hash the new password', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const oldPasswordHash = user!.password.toValue();
      const newPassword = 'NewSecurePassword123!';
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword,
      });

      // Act
      await commandHandler.execute(command);

      // Assert - Verify password was changed and is different from old password
      const updatedUser = await userRepository.findById(user!.id);
      expect(updatedUser!.password.toValue()).not.toBe(oldPasswordHash);
      expect(updatedUser!.password.toValue()).not.toBe(newPassword); // Should be hashed, not plaintext
    });
  });

  describe('Integration Events', () => {
    it('should store integration event in the outbox', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository, outboxRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword: 'NewSecurePassword123!',
      });

      // Act
      await commandHandler.execute(command);

      // Assert
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(1);

      const event = PasswordResetCompleted_IntegrationEvent.fromJSON(
        outboxEvents[0].payload.toJSON(),
      );
      expect(event.id).toBeDefined();
      expect(event.userId).toBe(user!.id.toValue());
      expect(event.email).toBe(user!.email.toValue());
      expect(event.occurredOn).toBeInstanceOf(Date);
    });

    it('should propagate failures when storing the integration event in the Outbox fails', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, user } = await setup({
        shouldFailOutbox: true,
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const oldPasswordHash = user!.password.toValue();
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
        newPassword: 'NewSecurePassword123!',
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);

      // Verify transaction rollback: password should not have changed
      const updatedUser = await userRepository.findById(user!.id);
      expect(updatedUser!.password.toValue()).toBe(oldPasswordHash);

      // Verify transaction rollback: password reset should not be marked as used
      const updatedPasswordReset = await passwordResetRepository.findById(passwordReset.id);
      expect(updatedPasswordReset!.isUsed()).toBe(false);
    });
  });

  describe('Validation & Error Cases', () => {
    it('should throw NotFoundException when password reset does not exist', async () => {
      // Arrange
      const { commandHandler } = await setup();
      const command = createCommand();

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository } = await setup();
      const passwordReset = await createPasswordReset(passwordResetRepository, Email.random());
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw InvalidOperationException when password reset is expired', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(
        passwordResetRepository,
        user!.email,
        false, // expired
      );
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InvalidOperationException);
    });

    it('should throw InvalidOperationException when password reset is already used', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      passwordReset.used = Used.yes();
      await passwordResetRepository.save(passwordReset);
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InvalidOperationException);
    });

    it('should throw InfrastructureException when user repository fails', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);

      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      userRepository.shouldFail = true;

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should throw InfrastructureException when password reset repository fails', async () => {
      // Arrange
      const { commandHandler, passwordResetRepository, user } = await setup({
        withUser: true,
      });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);

      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      passwordResetRepository.shouldFail = true;

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should throw ApplicationException when EventBus publishing fails', async () => {
      // Arrange
      const { commandHandler, userRepository, passwordResetRepository, outboxRepository, user } =
        await setup({
          shouldFailEventBus: true,
          withUser: true,
        });
      const passwordReset = await createPasswordReset(passwordResetRepository, user!.email);
      const oldPasswordHash = user!.password.toValue();
      const command = createCommand({
        passwordResetId: passwordReset.id.toValue(),
      });

      // Act & Assert
      await expect(commandHandler.execute(command)).rejects.toThrow(ApplicationException);

      // Verify transaction rollback: password should not have changed
      const updatedUser = await userRepository.findById(user!.id);
      expect(updatedUser!.password.toValue()).toBe(oldPasswordHash);

      // Verify transaction rollback: password reset should not be marked as used
      const updatedPasswordReset = await passwordResetRepository.findById(passwordReset.id);
      expect(updatedPasswordReset!.isUsed()).toBe(false);

      // Verify that the integration event was not stored in the Outbox
      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(0);
    });
  });
});
