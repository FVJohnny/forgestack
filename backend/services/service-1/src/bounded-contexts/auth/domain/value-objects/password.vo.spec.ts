import { DomainValidationException } from '@libs/nestjs-common';
import { Password } from './password.vo';

describe('Password Value Object', () => {
  describe('createFromPlainText', () => {
    it('should hash the password (output differs from input)', async () => {
      const plainText = 'MySecurePass1!';
      const password = await Password.createFromPlainText(plainText);

      // The stored value should be a bcrypt hash, not the plaintext
      expect(password.toValue()).not.toBe(plainText);
      expect(password.toValue()).toMatch(/^\$2[aby]?\$/); // bcrypt hash prefix
    });

    it('should produce different hashes for the same input (bcrypt salt)', async () => {
      const plainText = 'SamePassword99!';
      const password1 = await Password.createFromPlainText(plainText);
      const password2 = await Password.createFromPlainText(plainText);

      expect(password1.toValue()).not.toBe(password2.toValue());
    });

    it('should reject empty password', async () => {
      await expect(Password.createFromPlainText('')).rejects.toThrow(DomainValidationException);
    });

    it('should reject whitespace-only password', async () => {
      await expect(Password.createFromPlainText('   ')).rejects.toThrow(DomainValidationException);
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(Password.createFromPlainText('short')).rejects.toThrow(
        DomainValidationException,
      );
    });

    it('should accept password exactly 8 characters long', async () => {
      const password = await Password.createFromPlainText('12345678');
      expect(password).toBeDefined();
    });
  });

  describe('createFromPlainTextSync', () => {
    it('should hash synchronously and verify correctly', async () => {
      const plainText = 'SyncPassword1!';
      const password = Password.createFromPlainTextSync(plainText);

      const verifies = await password.verify(plainText);
      expect(verifies).toBe(true);
    });

    it('should reject short passwords in sync mode too', () => {
      expect(() => Password.createFromPlainTextSync('short')).toThrow(DomainValidationException);
    });
  });

  describe('createFromHash', () => {
    it('should wrap an existing bcrypt hash without re-hashing', async () => {
      const original = await Password.createFromPlainText('TestPassword1!');
      const fromHash = Password.createFromHash(original.toValue());

      expect(fromHash.toValue()).toBe(original.toValue());
    });

    it('should reject empty hash', () => {
      expect(() => Password.createFromHash('')).toThrow(DomainValidationException);
    });
  });

  describe('verify', () => {
    it('should return true for matching plaintext', async () => {
      const plainText = 'CorrectPassword1!';
      const password = await Password.createFromPlainText(plainText);

      expect(await password.verify(plainText)).toBe(true);
    });

    it('should return false for wrong plaintext', async () => {
      const password = await Password.createFromPlainText('CorrectPassword1!');

      expect(await password.verify('WrongPassword1!')).toBe(false);
    });

    it('should return false for similar but not identical plaintext', async () => {
      const password = await Password.createFromPlainText('MyPassword123');

      // Off by one character
      expect(await password.verify('MyPassword124')).toBe(false);
    });
  });

  describe('random', () => {
    it('should return a Password instance', () => {
      const password = Password.random();
      expect(password).toBeInstanceOf(Password);
      expect(password.toValue()).toBeDefined();
    });
  });
});
