import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import {
  AlreadyExistsException,
  DateVO,
  Id,
  InvalidOperationException,
  Timestamps,
  wait,
} from '@libs/nestjs-common';
import { PasswordResetUniquenessChecker_Mock } from '../../services/password-reset-uniqueness-checker.mock';
import { PasswordResetRequested_DomainEvent } from './events/password-reset-requested.domain-event';
import { PasswordReset } from './password-reset.aggregate';
import { PasswordResetDTO } from './password-reset.dto';

describe('PasswordReset Entity', () => {
  const createTestPasswordReset = (type = 'valid' as 'valid' | 'expired' | 'used'): PasswordReset =>
    new PasswordReset({
      id: Id.random(),
      email: Email.random(),
      expiration: Expiration.atHoursFromNow(type === 'expired' ? -1 : 1),
      used: type === 'used' ? Used.yes() : Used.no(),
      timestamps: Timestamps.create(),
    });

  describe('Creation', () => {
    it('should create with default values', async () => {
      const email = Email.random();
      const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();
      const passwordReset = await PasswordReset.create({ email }, passwordResetUniquenessChecker);

      expect(passwordReset.id).toBeDefined();
      expect(passwordReset.email).toBe(email);
      expect(passwordReset.used.isUsed()).toBe(false);
      expect(passwordReset.expiration.toValue()).toBeInstanceOf(Date);
      expect(passwordReset.timestamps).toBeInstanceOf(Timestamps);
      expect(passwordReset.timestamps.createdAt.toValue()).toBeInstanceOf(Date);
      expect(passwordReset.timestamps.updatedAt.toValue()).toBeInstanceOf(Date);
    });

    it('should generate unique identifiers', async () => {
      const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();

      const passwordReset1 = await PasswordReset.create(
        { email: Email.random() },
        passwordResetUniquenessChecker,
      );
      const passwordReset2 = await PasswordReset.create(
        { email: Email.random() },
        passwordResetUniquenessChecker,
      );

      expect(passwordReset1.id).not.toBe(passwordReset2.id);
    });

    it('should set default expiration to 1 hour', async () => {
      const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();

      const passwordReset = await PasswordReset.create(
        { email: Email.random() },
        passwordResetUniquenessChecker,
      );
      const expectedExpiration = Expiration.atHoursFromNow(1).toValue();

      expect(passwordReset.expiration.isWithinTolerance(expectedExpiration, 5000)).toBe(true);
    });

    it('should emit PasswordResetRequestedDomainEvent', async () => {
      const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();
      const passwordReset = await PasswordReset.create(
        { email: Email.random() },
        passwordResetUniquenessChecker,
      );

      const events = passwordReset.getUncommittedEvents();

      expect(events).toHaveLength(1);
      const event = events[0] as PasswordResetRequested_DomainEvent;
      expect(event).toBeInstanceOf(PasswordResetRequested_DomainEvent);
      expect(event.email).toBe(passwordReset.email);
      expect(event.expiration).toBe(passwordReset.expiration);
    });

    describe('Uniqueness Validation', () => {
      it('should throw AlreadyExistsException when a valid password reset already exists', async () => {
        const email = Email.random();
        const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock(false);

        await expect(
          PasswordReset.create({ email }, passwordResetUniquenessChecker),
        ).rejects.toThrow(AlreadyExistsException);
      });

      it('should allow creation when no valid password reset exists', async () => {
        const email = Email.random();
        const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock(true);

        const passwordReset = await PasswordReset.create({ email }, passwordResetUniquenessChecker);

        expect(passwordReset).toBeDefined();
        expect(passwordReset.email).toBe(email);
      });
    });
  });

  describe('markAsUsed', () => {
    it('should mark as used successfully', () => {
      const passwordReset = createTestPasswordReset();

      expect(passwordReset.isUsed()).toBe(false);

      passwordReset.use();

      expect(passwordReset.isUsed()).toBe(true);
    });

    it('should prevent marking expired password reset as used', () => {
      const expiredPasswordReset = createTestPasswordReset('expired');

      expect(() => expiredPasswordReset.use()).toThrow(InvalidOperationException);
    });

    it('should prevent marking already used password reset as used again', () => {
      const passwordReset = createTestPasswordReset();
      passwordReset.use();

      expect(() => passwordReset.use()).toThrow(InvalidOperationException);
    });

    it('should update timestamps when marked as used', async () => {
      const passwordReset = createTestPasswordReset();
      const originalUpdatedAt = new DateVO(passwordReset.timestamps.updatedAt.toValue());

      await wait(10);
      passwordReset.use();

      expect(passwordReset.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
    });
  });

  describe('State Queries', () => {
    it('should identify expired password reset', () => {
      const passwordReset = createTestPasswordReset('expired');

      expect(passwordReset.isUsed()).toBe(false);
      expect(passwordReset.isExpired()).toBe(true);
    });

    it('should identify used password reset', () => {
      const passwordReset = createTestPasswordReset('used');

      expect(passwordReset.isUsed()).toBe(true);
      expect(passwordReset.isExpired()).toBe(false);
    });

    it('should identify valid password reset', () => {
      const passwordReset = createTestPasswordReset();

      expect(passwordReset.isExpired()).toBe(false);
      expect(passwordReset.isUsed()).toBe(false);
    });

    it('should identify expired and used password reset as invalid', () => {
      const passwordReset = createTestPasswordReset('expired');
      passwordReset.used = Used.yes(); // Manually set to test combination

      expect(passwordReset.isExpired()).toBe(true);
      expect(passwordReset.isUsed()).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should convert to DTO', () => {
      const passwordReset = createTestPasswordReset();

      const dto = passwordReset.toValue();

      expect(dto).toEqual({
        id: passwordReset.id.toValue(),
        email: passwordReset.email.toValue(),
        expiration: passwordReset.expiration.toValue(),
        used: passwordReset.used.toValue(),
        createdAt: passwordReset.timestamps.createdAt.toValue(),
        updatedAt: passwordReset.timestamps.updatedAt.toValue(),
      });
    });

    it('should create from DTO', () => {
      const dto = PasswordResetDTO.random();
      const passwordReset = PasswordReset.fromValue(dto);

      expect(passwordReset.id.toValue()).toBe(dto.id);
      expect(passwordReset.email.toValue()).toBe(dto.email);
      expect(passwordReset.expiration.toValue()).toEqual(dto.expiration);
      expect(passwordReset.used.toValue()).toEqual(dto.used);
      expect(passwordReset.timestamps.createdAt.toValue()).toEqual(dto.createdAt);
      expect(passwordReset.timestamps.updatedAt.toValue()).toEqual(dto.updatedAt);
    });
  });

  describe('Random Generation', () => {
    it('should create random password reset', () => {
      const passwordReset = PasswordReset.random();

      expect(passwordReset.id).toBeDefined();
      expect(passwordReset.email).toBeDefined();
      expect(passwordReset.expiration).toBeDefined();
      expect(passwordReset.used).toBeDefined();
      expect(passwordReset.timestamps).toBeDefined();
    });

    it('should accept partial overrides', () => {
      const email = Email.random();
      const passwordReset = PasswordReset.random({ email });

      expect(passwordReset.email).toBe(email);
      expect(passwordReset.id).toBeDefined();
    });
  });
});
