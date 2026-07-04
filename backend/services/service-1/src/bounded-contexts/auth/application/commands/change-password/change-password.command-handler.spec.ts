import { UserPasswordChanged_DomainEvent } from '@bc/auth/domain/aggregates/user/events/password-changed.domain-event';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Password, UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import {
  ForbiddenException,
  Id,
  MockEventBus,
  NotFoundException,
  Outbox_InMemoryRepository,
} from '@libs/nestjs-common';
import { ChangePassword_Command } from './change-password.command';
import { ChangePassword_CommandHandler } from './change-password.command-handler';

describe('ChangePasswordCommandHandler', () => {
  const PLAIN_OLD_PASSWORD = 'OldPassword123!';
  const PLAIN_NEW_PASSWORD = 'NewPassword456!';

  const setup = async () => {
    const userRepository = new User_InMemoryRepository();
    const outboxRepository = new Outbox_InMemoryRepository();
    const eventBus = new MockEventBus();
    const commandHandler = new ChangePassword_CommandHandler(
      userRepository,
      eventBus,
      outboxRepository,
    );

    // Create a user with a known password
    const hashedPassword = await Password.createFromPlainText(PLAIN_OLD_PASSWORD);
    const user = User.random({
      password: hashedPassword,
      status: UserStatus.active(),
      role: UserRole.user(),
    });
    await userRepository.save(user);

    return { userRepository, eventBus, commandHandler, user };
  };

  describe('Happy Path', () => {
    it('should change password when old password is correct', async () => {
      const { commandHandler, userRepository, user } = await setup();

      await commandHandler.execute(
        new ChangePassword_Command(user.id.toValue(), PLAIN_OLD_PASSWORD, PLAIN_NEW_PASSWORD),
      );

      const updatedUser = await userRepository.findById(user.id);
      // New password should verify against the new plaintext
      const verifyNew = await updatedUser!.password.verify(PLAIN_NEW_PASSWORD);
      expect(verifyNew).toBe(true);

      // Old password should no longer work
      const verifyOld = await updatedUser!.password.verify(PLAIN_OLD_PASSWORD);
      expect(verifyOld).toBe(false);
    });

    it('should publish UserPasswordChanged domain event', async () => {
      const { commandHandler, eventBus, user } = await setup();

      await commandHandler.execute(
        new ChangePassword_Command(user.id.toValue(), PLAIN_OLD_PASSWORD, PLAIN_NEW_PASSWORD),
      );

      // changePassword emits UserPasswordChanged + UserLogout (via logout())
      const passwordChangedEvents = eventBus.events.filter(
        (e) => e instanceof UserPasswordChanged_DomainEvent,
      );
      expect(passwordChangedEvents).toHaveLength(1);

      const event = passwordChangedEvents[0] as UserPasswordChanged_DomainEvent;
      expect(event.aggregateId.toValue()).toBe(user.id.toValue());
      expect(event.email.toValue()).toBe(user.email.toValue());
    });

    it('should trigger a logout after password change (revoke sessions)', async () => {
      const { commandHandler, eventBus, user } = await setup();

      await commandHandler.execute(
        new ChangePassword_Command(user.id.toValue(), PLAIN_OLD_PASSWORD, PLAIN_NEW_PASSWORD),
      );

      // The User.changePassword method calls this.logout() which emits UserLogout_DomainEvent
      expect(eventBus.events.length).toBeGreaterThanOrEqual(2);
      const eventNames = eventBus.events.map((e) => e.constructor.name);
      expect(eventNames).toContain('UserLogout_DomainEvent');
    });
  });

  describe('Security: Old Password Verification', () => {
    it('should throw ForbiddenException when old password is wrong', async () => {
      const { commandHandler, user } = await setup();

      await expect(
        commandHandler.execute(
          new ChangePassword_Command(user.id.toValue(), 'WrongPassword99!', PLAIN_NEW_PASSWORD),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not modify the stored password when old password is wrong', async () => {
      const { commandHandler, userRepository, user } = await setup();

      try {
        await commandHandler.execute(
          new ChangePassword_Command(user.id.toValue(), 'WrongPassword99!', PLAIN_NEW_PASSWORD),
        );
      } catch {
        // expected
      }

      const unchangedUser = await userRepository.findById(user.id);
      const stillVerifies = await unchangedUser!.password.verify(PLAIN_OLD_PASSWORD);
      expect(stillVerifies).toBe(true);
    });

    it('should not publish any events when old password is wrong', async () => {
      const { commandHandler, eventBus, user } = await setup();

      try {
        await commandHandler.execute(
          new ChangePassword_Command(user.id.toValue(), 'WrongPassword99!', PLAIN_NEW_PASSWORD),
        );
      } catch {
        // expected
      }

      expect(eventBus.events).toHaveLength(0);
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      const { commandHandler } = await setup();
      const nonExistentId = Id.random().toValue();

      await expect(
        commandHandler.execute(
          new ChangePassword_Command(nonExistentId, PLAIN_OLD_PASSWORD, PLAIN_NEW_PASSWORD),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
