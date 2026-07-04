import { UserUniquenessChecker_Mock } from '@bc/auth/domain/services/user-uniqueness-checker/user-uniqueness-checker.mock';
import {
  Email,
  LastLogin,
  Password,
  UserRole,
  UserRoleEnum,
  UserStatus,
  UserStatusEnum,
} from '@bc/auth/domain/value-objects';
import {
  AlreadyExistsException,
  DateVO,
  Id,
  InvalidOperationException,
  Timestamps,
  wait,
} from '@libs/nestjs-common';
import { UserPasswordChanged_DomainEvent } from './events/password-changed.domain-event';
import type { UserDeleted_DomainEvent } from './events/user-deleted.domain-event';
import { UserLogout_DomainEvent } from './events/user-logout.domain-event';
import { UserRegistered_DomainEvent } from './events/user-registered.domain-event';
import { User } from './user.aggregate';
import { UserDTO } from './user.dto';

describe('User Entity', () => {
  const setup = ({ emailIsUnique = true }: { emailIsUnique?: boolean } = {}) => {
    const uniquenessChecker = new UserUniquenessChecker_Mock(emailIsUnique);
    return { uniquenessChecker };
  };

  describe('create()', () => {
    it('should create a new active user (email verification disabled)', async () => {
      // Arrange
      const { uniquenessChecker } = setup();
      const email = new Email('test@example.com');
      const password = await Password.createFromPlainText('Password123!');

      // Act
      const user = await User.create({ email, password }, uniquenessChecker);

      // Assert
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBeInstanceOf(Id);
      expect(user.email).toBe(email);
      expect(user.password).toBe(password);
      expect(user.role.equals(UserRole.user())).toBe(true);
      expect(user.status.toValue()).toBe(UserStatusEnum.ACTIVE);
      expect(user.lastLogin).toBeInstanceOf(LastLogin);
      expect(user.lastLogin.isNever()).toBe(true);
      expect(user.timestamps).toBeInstanceOf(Timestamps);
    });

    it('should emit UserRegisteredDomainEvent when created', async () => {
      // Arrange
      const { uniquenessChecker } = setup();
      const email = new Email('test@example.com');
      const password = await Password.createFromPlainText('Password123!');

      // Act
      const user = await User.create(
        {
          email,
          password,
        },
        uniquenessChecker,
      );

      // Assert
      const events = user.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserRegistered_DomainEvent);

      const event = events[0] as UserRegistered_DomainEvent;
      expect(event.aggregateId).toBe(user.id);
      expect(event.email).toBe(email);
      expect(event.role.equals(UserRole.user())).toBe(true);
    });

    it('should default role to user when not provided', async () => {
      // Arrange
      const { uniquenessChecker } = setup();
      const email = new Email('default-role@example.com');
      const password = await Password.createFromPlainText('Password123!');

      // Act
      const user = await User.create({ email, password }, uniquenessChecker);

      // Assert
      expect(user.role.equals(UserRole.user())).toBe(true);
      const events = user.getUncommittedEvents();
      expect(events).toHaveLength(1);
      const event = events[0] as UserRegistered_DomainEvent;
      expect(event.role.equals(UserRole.user())).toBe(true);
    });

    describe('Uniqueness Validation', () => {
      it('should throw AlreadyExistsException when email already exists', async () => {
        // Arrange
        const { uniquenessChecker } = setup({ emailIsUnique: false });
        const email = new Email('duplicate@example.com');
        const password = await Password.createFromPlainText('Password123!');

        // Act & Assert
        await expect(User.create({ email, password }, uniquenessChecker)).rejects.toThrow(
          AlreadyExistsException,
        );
      });

      it('should throw AlreadyExistsException with correct field when email is duplicate', async () => {
        // Arrange
        const { uniquenessChecker } = setup({ emailIsUnique: false });
        const duplicateEmail = 'duplicate@example.com';
        const email = new Email(duplicateEmail);
        const password = await Password.createFromPlainText('Password123!');

        // Act & Assert
        await expect(User.create({ email, password }, uniquenessChecker)).rejects.toThrow(
          new AlreadyExistsException('email', duplicateEmail),
        );
      });
    });

    describe('random()', () => {
      it('should create a user with random values', () => {
        // Act
        const user = User.random();

        // Assert
        expect(user).toBeInstanceOf(User);
        expect(user.id).toBeInstanceOf(Id);
        expect(user.email).toBeInstanceOf(Email);
        expect(user.password).toBeInstanceOf(Password);
        expect(user.status).toBeInstanceOf(UserStatus);
        expect(user.role).toBeInstanceOf(UserRole);
        expect(user.lastLogin).toBeInstanceOf(LastLogin);
        expect(user.timestamps).toBeInstanceOf(Timestamps);
      });

      it('should accept partial overrides', () => {
        // Arrange
        const customEmail = new Email('custom@example.com');
        const customStatus = UserStatus.active();
        const customRole = UserRole.admin();

        // Act
        const user = User.random({
          email: customEmail,
          status: customStatus,
          role: customRole,
        });

        // Assert
        expect(user.email).toBe(customEmail);
        expect(user.status).toBe(customStatus);
        expect(user.role).toBe(customRole);
      });

      it('should generate unique users on each call', () => {
        // Act
        const user1 = User.random();
        const user2 = User.random();

        // Assert
        expect(user1.id.toValue()).not.toBe(user2.id.toValue());
        expect(user1.email.toValue()).not.toBe(user2.email.toValue());
      });
    });

    describe('activate()', () => {
      it('should activate an inactive user', async () => {
        // Arrange
        const user = User.random({ status: UserStatus.inactive() });
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());
        await wait(10);

        // Act
        user.activate();

        // Assert
        expect(user.status.toValue()).toBe(UserStatusEnum.ACTIVE);
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should throw InvalidOperationException for email-verification-pending user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.emailVerificationPending() });
        // Act
        expect(() => user.activate()).toThrow(InvalidOperationException);
      });

      it('should throw InvalidOperationException for active user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.active() });
        // Act
        expect(() => user.activate()).toThrow(InvalidOperationException);
      });
    });

    describe('deactivate()', () => {
      it('should deactivate an active user', async () => {
        // Arrange
        const user = User.random({ status: UserStatus.active() });
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());
        await wait(10);

        // Act
        user.deactivate();

        // Assert
        expect(user.status.toValue()).toBe(UserStatusEnum.INACTIVE);
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should throw InvalidOperationException for email-verification-pending user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.emailVerificationPending() });
        // Act
        expect(() => user.deactivate()).toThrow(InvalidOperationException);
      });

      it('should throw InvalidOperationException for inactive user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.inactive() });
        // Act
        expect(() => user.deactivate()).toThrow(InvalidOperationException);
      });
    });

    describe('verifyEmail()', () => {
      it('should verify email for user with pending verification status', () => {
        // Arrange
        const user = User.random({ status: UserStatus.emailVerificationPending() });
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());

        // Act
        user.verifyEmail();

        // Assert
        expect(user.status.toValue()).toBe(UserStatusEnum.ACTIVE);
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should throw InvalidOperationException for active user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.active() });

        // Act & Assert
        expect(() => user.verifyEmail()).toThrow(InvalidOperationException);
      });

      it('should throw InvalidOperationException for inactive user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.inactive() });

        // Act & Assert
        expect(() => user.verifyEmail()).toThrow(InvalidOperationException);
      });
    });

    describe('hasRole()', () => {
      it('should return true when user has the specified role', () => {
        // Arrange
        const adminRole = UserRole.admin();
        const user = User.random({ role: adminRole });

        // Act & Assert
        expect(user.hasRole(adminRole)).toBe(true);
      });

      it('should return false when user does not have the specified role', () => {
        // Arrange
        const user = User.random({ role: UserRole.user() });

        // Act & Assert
        expect(user.hasRole(UserRole.admin())).toBe(false);
      });
    });

    describe('changeRole()', () => {
      it('should change role when new role is different', () => {
        // Arrange
        const user = User.random({ role: UserRole.user() });
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());
        const newRole = UserRole.admin();

        // Act
        user.changeRole(newRole);

        // Assert
        expect(user.role).toBe(newRole);
        expect(user.hasRole(newRole)).toBe(true);
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should not update timestamps when changing to the same role', () => {
        // Arrange
        const role = UserRole.user();
        const user = User.random({ role });
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());

        // Act
        user.changeRole(role);

        // Assert
        expect(user.role).toBe(role);
        expect(user.timestamps.updatedAt.equals(originalUpdatedAt)).toBe(true);
      });
    });

    describe('changePassword()', () => {
      it('should change password successfully', async () => {
        // Arrange
        const user = User.random();
        const oldPasswordHash = user.password.toValue();
        const newPassword = await Password.createFromPlainText('NewPassword456!');

        // Act
        user.changePassword(newPassword);

        // Assert
        expect(user.password).toBe(newPassword);
        expect(user.password.toValue()).not.toBe(oldPasswordHash);
      });

      it('should update timestamps when password is changed', async () => {
        // Arrange
        const user = User.random();
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());
        const newPassword = await Password.createFromPlainText('NewPassword456!');
        await wait(10);

        // Act
        user.changePassword(newPassword);

        // Assert
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should emit UserPasswordChanged domain event when password is changed', async () => {
        // Arrange
        const user = User.random();
        const newPassword = await Password.createFromPlainText('NewPassword456!');

        // Act
        user.changePassword(newPassword);

        // Assert
        const events = user.getUncommittedEvents();
        expect(events).toHaveLength(2);
        expect(events[0]).toBeInstanceOf(UserPasswordChanged_DomainEvent);
        expect(events[1]).toBeInstanceOf(UserLogout_DomainEvent);

        const passwordChangedEvent = events[0] as UserPasswordChanged_DomainEvent;
        expect(passwordChangedEvent.aggregateId).toBe(user.id);
        expect(passwordChangedEvent.email).toBe(user.email);

        const logoutEvent = events[1] as UserLogout_DomainEvent;
        expect(logoutEvent.aggregateId).toBe(user.id);
      });

      it('should allow changing password multiple times', async () => {
        // Arrange
        const user = User.random();
        const password1 = await Password.createFromPlainText('Password1!');
        const password2 = await Password.createFromPlainText('Password2!');
        const password3 = await Password.createFromPlainText('Password3!');

        // Act
        user.changePassword(password1);
        expect(user.password).toBe(password1);

        user.changePassword(password2);
        expect(user.password).toBe(password2);

        user.changePassword(password3);
        expect(user.password).toBe(password3);

        // Assert
        expect(user.password).toBe(password3);
      });
    });

    describe('isActive()', () => {
      it('should return true for active user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.active() });

        // Act & Assert
        expect(user.isActive()).toBe(true);
      });

      it('should return false for inactive user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.inactive() });

        // Act & Assert
        expect(user.isActive()).toBe(false);
      });

      it('should return false for email verification pending user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.emailVerificationPending() });

        // Act & Assert
        expect(user.isActive()).toBe(false);
      });
    });

    describe('isEmailVerificationPending()', () => {
      it('should return true for user with email verification pending status', () => {
        // Arrange
        const user = User.random({ status: UserStatus.emailVerificationPending() });

        // Act & Assert
        expect(user.isEmailVerificationPending()).toBe(true);
      });

      it('should return false for active user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.active() });

        // Act & Assert
        expect(user.isEmailVerificationPending()).toBe(false);
      });

      it('should return false for inactive user', () => {
        // Arrange
        const user = User.random({ status: UserStatus.inactive() });

        // Act & Assert
        expect(user.isEmailVerificationPending()).toBe(false);
      });
    });

    describe('recordLogin()', () => {
      it('should update lastLogin to current time', async () => {
        // Arrange
        const user = User.random();
        const beforeLogin = DateVO.now();

        await wait(10);

        // Act
        user.recordLogin();

        await wait(10);

        const afterLogin = DateVO.now();

        // Assert
        expect(user.lastLogin.isNever()).toBe(false);
        expect(user.lastLogin.isAfter(beforeLogin)).toBe(true);
        expect(user.lastLogin.isBefore(afterLogin)).toBe(true);
      });

      it('should update timestamps when recording login', async () => {
        // Arrange
        const user = User.random();
        const originalUpdatedAt = new DateVO(user.timestamps.updatedAt.toValue());

        await wait(10);

        // Act
        user.recordLogin();

        // Assert
        expect(user.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
      });

      it('should update lastLogin from never to actual date', () => {
        // Arrange
        const user = User.random({ lastLogin: LastLogin.never() });
        expect(user.lastLogin.isNever()).toBe(true);

        // Act
        user.recordLogin();

        // Assert
        expect(user.lastLogin.isNever()).toBe(false);
        expect(user.lastLogin.toValue()).toBeInstanceOf(Date);
      });
    });

    describe('fromValue()', () => {
      it('should create user from DTO', async () => {
        // Arrange
        const dto = UserDTO.random();

        // Act
        const user = User.fromValue(dto);

        // Assert
        expect(user.id.toValue()).toBe(dto.id);
        expect(user.email.toValue()).toBe(dto.email);
        expect(user.password.toValue()).toBe(dto.password);
        expect(user.status.toValue()).toBe(dto.status);
        expect(user.role.toValue()).toBe(dto.role);
        expect(user.lastLogin.toValue()).toEqual(dto.lastLogin);
        expect(user.timestamps.createdAt.toValue()).toEqual(dto.createdAt);
        expect(user.timestamps.updatedAt.toValue()).toEqual(dto.updatedAt);
      });
    });

    describe('toValue()', () => {
      it('should convert user to DTO', async () => {
        // Arrange
        const user = User.random({
          email: new Email('test@example.com'),
          password: await Password.createFromPlainText('Password123!'),
          status: UserStatus.active(),
          role: UserRole.admin(),
          lastLogin: new LastLogin(new Date('2024-01-01T12:00:00Z')),
        });

        // Act
        const dto = user.toValue();

        // Assert
        expect(dto.id).toBe(user.id.toValue());
        expect(dto.email).toBe('test@example.com');
        const password = await Password.createFromHash(dto.password);
        expect(await password.verify('Password123!')).toBe(true);
        expect(dto.status).toBe(UserStatusEnum.ACTIVE);
        expect(dto.role).toBe(UserRoleEnum.ADMIN);
        expect(dto.lastLogin).toEqual(new Date('2024-01-01T12:00:00Z'));
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('delete()', () => {
      it('should emit domain event for user deletion', () => {
        const user = User.random({ status: UserStatus.active() });

        user.delete();

        const events = user.getUncommittedEvents();
        expect(events).toHaveLength(1);
        const event = events[0] as UserDeleted_DomainEvent;
        expect(event.constructor.name).toBe('UserDeleted_DomainEvent');
        expect(event.aggregateId.toValue()).toBe(user.id.toValue());
      });
    });

    describe('suspend()', () => {
      it('should suspend the user', () => {
        const user = User.random({ status: UserStatus.active() });

        user.suspend();

        expect(user.status.toValue()).toBe(UserStatusEnum.SUSPENDED);
      });
    });

    describe('Integration scenarios', () => {
      it('should handle complete user lifecycle', async () => {
        // Arrange
        const { uniquenessChecker } = setup();

        // Create user
        const user = await User.create(
          {
            email: new Email('lifecycle@example.com'),
            password: await Password.createFromPlainText('Password123!'),
          },
          uniquenessChecker,
        );

        // Verify initial state — users are active immediately (verification disabled)
        expect(user.isActive()).toBe(true);
        expect(user.isEmailVerificationPending()).toBe(false);
        expect(user.lastLogin.isNever()).toBe(true);

        // Record login
        user.recordLogin();
        expect(user.lastLogin.isNever()).toBe(false);

        // Change role
        user.changeRole(UserRole.admin());
        expect(user.hasRole(UserRole.admin())).toBe(true);

        // Deactivate
        user.deactivate();
        expect(user.isActive()).toBe(false);

        // Reactivate
        user.activate();
        expect(user.isActive()).toBe(true);
      });

      it('should serialize and deserialize correctly', async () => {
        // Arrange
        const originalUser = User.random({
          email: new Email('serialize@example.com'),
          password: await Password.createFromPlainText('Password123!'),
          status: UserStatus.active(),
          role: UserRole.admin(),
          lastLogin: new LastLogin(new Date('2024-06-15T14:30:00Z')),
        });

        // Act
        const dto = originalUser.toValue();
        const restoredUser = User.fromValue(dto);

        // Assert
        expect(restoredUser.id.toValue()).toBe(originalUser.id.toValue());
        expect(restoredUser.email.toValue()).toBe(originalUser.email.toValue());
        expect(restoredUser.password.toValue()).toBe(originalUser.password.toValue());
        expect(restoredUser.status.toValue()).toBe(originalUser.status.toValue());
        expect(restoredUser.role.toValue()).toBe(originalUser.role.toValue());
        expect(restoredUser.lastLogin.toValue()).toEqual(originalUser.lastLogin.toValue());
        expect(restoredUser.timestamps.createdAt.toValue()).toEqual(
          originalUser.timestamps.createdAt.toValue(),
        );
        expect(restoredUser.timestamps.updatedAt.toValue()).toEqual(
          originalUser.timestamps.updatedAt.toValue(),
        );
      });

      it('should maintain domain events on creation', async () => {
        // Arrange
        const { uniquenessChecker } = setup();

        // Act
        const user = await User.create(
          {
            email: new Email('events@example.com'),
            password: await Password.createFromPlainText('Password123!'),
          },
          uniquenessChecker,
        );

        // Assert - UserRegisteredDomainEvent should be emitted
        const events = user.getUncommittedEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(UserRegistered_DomainEvent);
      });
    });
  });
});
