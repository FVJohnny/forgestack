import { DomainValidationException } from '@libs/nestjs-common';
import { UserStatus, UserStatusEnum } from './user-status.vo';

describe('UserStatus Value Object', () => {
  describe('Construction', () => {
    it.each(Object.values(UserStatusEnum))('should accept valid status: %s', (status) => {
      const vo = new UserStatus(status);
      expect(vo.toValue()).toBe(status);
    });

    it('should throw DomainValidationException for invalid status', () => {
      expect(() => new UserStatus('bogus' as UserStatusEnum)).toThrow(DomainValidationException);
    });
  });

  describe('Factory Methods', () => {
    it('active() should produce ACTIVE status', () => {
      expect(UserStatus.active().toValue()).toBe(UserStatusEnum.ACTIVE);
    });

    it('inactive() should produce INACTIVE status', () => {
      expect(UserStatus.inactive().toValue()).toBe(UserStatusEnum.INACTIVE);
    });

    it('suspended() should produce SUSPENDED status', () => {
      expect(UserStatus.suspended().toValue()).toBe(UserStatusEnum.SUSPENDED);
    });

    it('emailVerificationPending() should produce EMAIL_VERIFICATION_PENDING status', () => {
      expect(UserStatus.emailVerificationPending().toValue()).toBe(
        UserStatusEnum.EMAIL_VERIFICATION_PENDING,
      );
    });
  });

  describe('Equality', () => {
    it('should be equal when statuses match', () => {
      expect(UserStatus.active().equals(UserStatus.active())).toBe(true);
    });

    it('should not be equal when statuses differ', () => {
      expect(UserStatus.active().equals(UserStatus.suspended())).toBe(false);
    });
  });

  describe('random', () => {
    it('should return a valid UserStatus', () => {
      const status = UserStatus.random();
      expect(Object.values(UserStatusEnum)).toContain(status.toValue());
    });
  });
});
