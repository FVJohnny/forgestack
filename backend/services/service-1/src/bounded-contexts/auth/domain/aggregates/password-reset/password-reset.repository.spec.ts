import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import { Id } from '@libs/nestjs-common';
import type { PasswordReset_Repository } from './password-reset.repository';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('PasswordResetRepository Contract Test Suite', () => {
  it('exports testPasswordResetRepositoryContract function', () => {
    expect(typeof testPasswordResetRepositoryContract).toBe('function');
  });
});

export function testPasswordResetRepositoryContract(
  description: string,
  createRepository: (passwordResets?: PasswordReset[]) => Promise<PasswordReset_Repository>,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  describe(`PasswordResetRepository Contract: ${description}`, () => {
    let repository: PasswordReset_Repository;

    if (setupTeardown?.beforeAll) {
      beforeAll(setupTeardown.beforeAll);
    }

    if (setupTeardown?.afterAll) {
      afterAll(setupTeardown.afterAll);
    }

    beforeEach(async () => {
      if (setupTeardown?.beforeEach) {
        await setupTeardown.beforeEach();
      }
      repository = await createRepository();
    });

    if (setupTeardown?.afterEach) {
      afterEach(setupTeardown.afterEach);
    }

    describe('Basic CRUD Operations', () => {
      describe('save', () => {
        it('should save a new password reset successfully', async () => {
          // Arrange
          const passwordReset = PasswordReset.random();

          // Act
          await repository.save(passwordReset);

          // Assert
          const saved = await repository.findByEmail(passwordReset.email);
          expect(saved).not.toBeNull();
          expect(saved?.id.toValue()).toBe(passwordReset.id.toValue());
          expect(saved?.email.toValue()).toBe(passwordReset.email.toValue());
        });

        it('should update an existing password reset when saving with same id', async () => {
          // Arrange
          const passwordReset = PasswordReset.random({
            used: Used.no(),
          });
          await repository.save(passwordReset);

          // Modify password reset
          passwordReset.use();

          // Act
          await repository.save(passwordReset);

          // Assert
          const saved = await repository.findById(passwordReset.id);
          expect(saved).not.toBeNull();
          expect(saved?.isUsed()).toBe(true);
        });

        it('should allow saving multiple password resets for different emails', async () => {
          // Arrange
          const passwordReset1 = PasswordReset.random();
          const passwordReset2 = PasswordReset.random();
          await repository.save(passwordReset1);
          await repository.save(passwordReset2);

          // Assert
          const saved1 = await repository.findByEmail(passwordReset1.email);
          const saved2 = await repository.findByEmail(passwordReset2.email);
          expect(saved1).not.toBeNull();
          expect(saved2).not.toBeNull();
          expect(saved1?.email.toValue()).toBe(passwordReset1.email.toValue());
          expect(saved2?.email.toValue()).toBe(passwordReset2.email.toValue());
        });
      });

      describe('findByEmail', () => {
        it('should find password reset by email', async () => {
          // Arrange
          const passwordReset = PasswordReset.random();
          await repository.save(passwordReset);

          // Act
          const found = await repository.findByEmail(passwordReset.email);

          // Assert
          expect(found).not.toBeNull();
          expect(found?.email.toValue()).toBe(passwordReset.email.toValue());
        });

        it('should return null when email not found', async () => {
          // Act
          const found = await repository.findByEmail(Email.random());

          // Assert
          expect(found).toBeNull();
        });
      });

      describe('findValidByEmail', () => {
        it('should find valid password reset by email', async () => {
          // Arrange
          const passwordReset = PasswordReset.random({
            expiration: Expiration.atHoursFromNow(1),
            used: Used.no(),
          });
          await repository.save(passwordReset);

          // Act
          const found = await repository.findValidByEmail(passwordReset.email);

          // Assert
          expect(found).not.toBeNull();
          expect(found?.email.toValue()).toBe(passwordReset.email.toValue());
          expect(found?.isUsed()).toBe(false);
          expect(found?.isExpired()).toBe(false);
        });

        it('should return null for expired password resets', async () => {
          // Arrange
          const passwordReset = PasswordReset.random({
            expiration: Expiration.atHoursFromNow(-1),
            used: Used.no(),
          });
          await repository.save(passwordReset);

          // Act
          const found = await repository.findValidByEmail(passwordReset.email);

          // Assert
          expect(found).toBeNull();
        });

        it('should return null for used password resets', async () => {
          // Arrange
          const passwordReset = PasswordReset.random({
            expiration: Expiration.atHoursFromNow(1),
            used: Used.yes(),
          });
          await repository.save(passwordReset);

          // Act
          const found = await repository.findValidByEmail(passwordReset.email);

          // Assert
          expect(found).toBeNull();
        });

        it('should return null when email not found', async () => {
          // Act
          const found = await repository.findValidByEmail(Email.random());

          // Assert
          expect(found).toBeNull();
        });
      });

      describe('remove', () => {
        it('should remove password reset by id', async () => {
          // Arrange
          const passwordReset = PasswordReset.random();
          await repository.save(passwordReset);

          // Act
          await repository.remove(passwordReset.id);

          // Assert
          const found = await repository.findByEmail(passwordReset.email);
          expect(found).toBeNull();
        });

        it('should not throw when removing non-existent id', async () => {
          // Act & Assert
          await expect(repository.remove(Id.random())).resolves.not.toThrow();
        });

        it('should only remove specified password reset', async () => {
          // Arrange
          const passwordReset1 = PasswordReset.random();
          const passwordReset2 = PasswordReset.random();
          await repository.save(passwordReset1);
          await repository.save(passwordReset2);

          // Act
          await repository.remove(passwordReset1.id);

          // Assert
          const found1 = await repository.findByEmail(passwordReset1.email);
          const found2 = await repository.findByEmail(passwordReset2.email);
          expect(found1).toBeNull();
          expect(found2).not.toBeNull();
        });
      });

      describe('exists', () => {
        it('should return true when password reset exists', async () => {
          // Arrange
          const passwordReset = PasswordReset.random();
          await repository.save(passwordReset);

          // Act
          const exists = await repository.exists(passwordReset.id);

          // Assert
          expect(exists).toBe(true);
        });

        it('should return false when password reset does not exist', async () => {
          // Act
          const exists = await repository.exists(Id.random());

          // Assert
          expect(exists).toBe(false);
        });

        it('should return false after removing password reset', async () => {
          // Arrange
          const passwordReset = PasswordReset.random();
          await repository.save(passwordReset);
          await repository.remove(passwordReset.id);

          // Act
          const exists = await repository.exists(passwordReset.id);

          // Assert
          expect(exists).toBe(false);
        });
      });
    });

    describe('Complex Scenarios', () => {
      beforeEach(async () => {
        repository = await createRepository();
      });

      it('should handle password reset lifecycle correctly', async () => {
        // Arrange
        const passwordReset = PasswordReset.random({
          expiration: Expiration.atHoursFromNow(1),
          used: Used.no(),
        });

        // Act & Assert - Initial state
        await repository.save(passwordReset);
        let found = await repository.findById(passwordReset.id);

        expect(found).not.toBeNull();
        expect(found?.isUsed()).toBe(false);
        expect(found?.isExpired()).toBe(false);

        // Act & Assert - After marking as used
        passwordReset.use();
        await repository.save(passwordReset);
        found = await repository.findById(passwordReset.id);

        expect(found).not.toBeNull();
        expect(found?.isUsed()).toBe(true);
        expect(found?.isExpired()).toBe(false);

        // Valid search should return null after marking as used
        const valid = await repository.findValidByEmail(passwordReset.email);
        expect(valid).toBeNull();
      });

      it('should handle concurrent operations correctly', async () => {
        // Arrange
        const passwordResets = Array.from({ length: 5 }, () => PasswordReset.random());

        // Act - Save all concurrently
        await Promise.all(passwordResets.map((pr) => repository.save(pr)));

        // Assert - All should be saved
        const foundPromises = passwordResets.map((pr) => repository.findByEmail(pr.email));
        const foundPasswordResets = await Promise.all(foundPromises);

        foundPasswordResets.forEach((found, index) => {
          expect(found).not.toBeNull();
          expect(found?.email.toValue()).toBe(passwordResets[index].email.toValue());
        });
      });
    });
  });
}
