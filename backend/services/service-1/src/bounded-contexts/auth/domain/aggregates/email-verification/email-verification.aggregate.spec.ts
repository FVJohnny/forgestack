import { EmailVerification } from './email-verification.aggregate';
import { Email, Verification, Expiration } from '@bc/auth/domain/value-objects';
import { EmailVerificationVerified_DomainEvent } from './events/email-verified.domain-event';
import { EmailVerificationCreated_DomainEvent } from './events/email-verification-created.domain-event';
import { InvalidOperationException, Id, Timestamps, wait, DateVO } from '@libs/nestjs-common';
import { EmailVerificationDTO } from './email-verification.dto';

describe('EmailVerification Entity', () => {
  const createTestVerification = (type = 'pending' as 'pending' | 'verified' | 'expired') =>
    new EmailVerification({
      id: Id.random(),
      userId: Id.random(),
      email: Email.random(),
      expiration: Expiration.atHoursFromNow(type === 'expired' ? -1 : 24),
      verification: type === 'verified' ? Verification.verified() : Verification.notVerified(),
      timestamps: Timestamps.create(),
    });

  describe('Creation', () => {
    it('should create with default values', () => {
      const email = Email.random();
      const userId = Id.random();

      const verification = EmailVerification.create({ userId, email });

      expect(verification.id).toBeDefined();
      expect(verification.userId).toBe(userId);
      expect(verification.email).toBe(email);
      expect(verification.verification.isVerified()).toBe(false);
      expect(verification.expiration.toValue()).toBeInstanceOf(Date);
      expect(verification.timestamps).toBeInstanceOf(Timestamps);
      expect(verification.timestamps.createdAt.toValue()).toBeInstanceOf(Date);
      expect(verification.timestamps.updatedAt.toValue()).toBeInstanceOf(Date);
    });

    it('should generate unique identifiers', () => {
      const verification1 = EmailVerification.create({
        userId: Id.random(),
        email: Email.random(),
      });
      const verification2 = EmailVerification.create({
        userId: Id.random(),
        email: Email.random(),
      });

      expect(verification1.id).not.toBe(verification2.id);
    });

    it('should set default expiration to 24 hours', () => {
      const emailVerification = EmailVerification.create({
        userId: Id.random(),
        email: Email.random(),
      });
      const expectedExpiration = Expiration.atHoursFromNow(24).toValue();

      expect(emailVerification.expiration.isWithinTolerance(expectedExpiration, 5000)).toBe(true);
    });

    it('should emit EmailVerificationCreatedDomainEvent', () => {
      const emailVerification = EmailVerification.create({
        userId: Id.random(),
        email: Email.random(),
      });
      const events = emailVerification.getUncommittedEvents();

      expect(events).toHaveLength(1);
      const event = events[0] as EmailVerificationCreated_DomainEvent;
      expect(event).toBeInstanceOf(EmailVerificationCreated_DomainEvent);
      expect(event.userId).toBe(emailVerification.userId);
      expect(event.email).toBe(emailVerification.email);
      expect(event.expiration).toBe(emailVerification.expiration);
    });
  });

  describe('Verification', () => {
    it('should verify successfully', () => {
      const verification = createTestVerification();

      expect(verification.isVerified()).toBe(false);

      verification.verify();

      expect(verification.isVerified()).toBe(true);
    });

    it('should emit EmailVerificationVerifiedDomainEvent', () => {
      const verification = createTestVerification();
      verification.verify();
      const events = verification.getUncommittedEvents();
      const verifiedEvent = events[0] as EmailVerificationVerified_DomainEvent;

      expect(verifiedEvent).toBeInstanceOf(EmailVerificationVerified_DomainEvent);
      expect(verifiedEvent.userId).toBe(verification.userId);
      expect(verifiedEvent.email).toBe(verification.email);
    });

    it('should prevent double verification', () => {
      const verification = createTestVerification();
      verification.verify();

      expect(() => verification.verify()).toThrow(InvalidOperationException);
    });

    it('should prevent verification of expired email verifications', () => {
      const expiredVerification = createTestVerification('expired');

      expect(() => expiredVerification.verify()).toThrow(InvalidOperationException);
    });

    it('should update timestamps on verification', async () => {
      const verification = createTestVerification();
      const originalUpdatedAt = new DateVO(verification.timestamps.updatedAt.toValue());

      await wait(10);
      verification.verify();

      expect(verification.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
    });
  });

  describe('State Queries', () => {
    it('should identify expired verification', () => {
      const verification = createTestVerification('expired');

      expect(verification.isVerified()).toBe(false);
      expect(verification.isPending()).toBe(false);
      expect(verification.isExpired()).toBe(true);
    });

    it('should identify pending verification', () => {
      const verification = createTestVerification();

      expect(verification.isExpired()).toBe(false);
      expect(verification.isVerified()).toBe(false);
      expect(verification.isPending()).toBe(true);
    });

    it('should identify verified as not pending', () => {
      const verification = createTestVerification('verified');

      expect(verification.isPending()).toBe(false);
      expect(verification.isExpired()).toBe(false);
      expect(verification.isVerified()).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should convert to DTO', () => {
      const emailVerification = createTestVerification();

      const dto = emailVerification.toValue();

      expect(dto).toEqual({
        id: emailVerification.id.toValue(),
        userId: emailVerification.userId.toValue(),
        email: emailVerification.email.toValue(),
        expiration: emailVerification.expiration.toValue(),
        verification: emailVerification.verification.toValue(),
        createdAt: emailVerification.timestamps.createdAt.toValue(),
        updatedAt: emailVerification.timestamps.updatedAt.toValue(),
      });
    });

    it('should create from DTO', () => {
      const dto = EmailVerificationDTO.random();
      const verification = EmailVerification.fromValue(dto);

      expect(verification.id.toValue()).toBe(dto.id);
      expect(verification.userId.toValue()).toBe(dto.userId);
      expect(verification.email.toValue()).toBe(dto.email);
      expect(verification.expiration.toValue()).toEqual(dto.expiration);
      expect(verification.verification.toValue()).toEqual(dto.verification);
      expect(verification.timestamps.createdAt.toValue()).toEqual(dto.createdAt);
      expect(verification.timestamps.updatedAt.toValue()).toEqual(dto.updatedAt);
    });
  });
});
