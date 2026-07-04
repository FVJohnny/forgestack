import type { EmailVerification_Repository } from './email-verification.repository';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { Email, Verification, Expiration } from '@bc/auth/domain/value-objects';
import { AlreadyExistsException, Id } from '@libs/nestjs-common';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('EmailVerificationRepository Contract Test Suite', () => {
  it('exports testEmailVerificationRepositoryContract function', () => {
    expect(typeof testEmailVerificationRepositoryContract).toBe('function');
  });
});

export function testEmailVerificationRepositoryContract(
  description: string,
  createRepository: (verifications?: EmailVerification[]) => Promise<EmailVerification_Repository>,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  describe(`EmailVerificationRepository Contract: ${description}`, () => {
    let repository: EmailVerification_Repository;

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
        it('should save a new email verification successfully', async () => {
          // Arrange
          const verification = EmailVerification.random();

          // Act
          await repository.save(verification);

          // Assert
          const savedVerification = await repository.findByUserId(verification.userId);
          expect(savedVerification).not.toBeNull();
          expect(savedVerification?.id.toValue()).toBe(verification.id.toValue());
          expect(savedVerification?.userId.toValue()).toBe(verification.userId.toValue());
          expect(savedVerification?.email.toValue()).toBe(verification.email.toValue());
        });

        it('should update an existing verification when saving with same id', async () => {
          // Arrange
          const verification = EmailVerification.random({
            verification: Verification.notVerified(),
          });
          await repository.save(verification);

          // Modify verification
          verification.verify();

          // Act
          await repository.save(verification);

          // Assert
          const savedVerification = await repository.findByUserId(verification.userId);
          expect(savedVerification).not.toBeNull();
          expect(savedVerification?.isVerified()).toBe(true);
        });

        it('should throw AlreadyExistsException when saving verification for user that already has one', async () => {
          // Arrange
          const verification1 = EmailVerification.random();
          const verification2 = EmailVerification.random({
            userId: verification1.userId,
          });

          // Act
          await repository.save(verification1);

          // Assert
          await expect(repository.save(verification2)).rejects.toThrow(AlreadyExistsException);
        });

        it('should throw AlreadyExistsException when saving verification with same email for different users', async () => {
          // Arrange
          const verification1 = EmailVerification.random();
          const verification2 = EmailVerification.random({
            email: verification1.email,
          });

          // Act
          await repository.save(verification1);

          // Assert
          await expect(repository.save(verification2)).rejects.toThrow(AlreadyExistsException);
        });

        it('should allow saving multiple verifications for different users with different emails', async () => {
          // Arrange
          const verification1 = EmailVerification.random();
          const verification2 = EmailVerification.random();
          await repository.save(verification1);
          await repository.save(verification2);

          // Assert
          const saved1 = await repository.findByUserId(verification1.userId);
          const saved2 = await repository.findByUserId(verification2.userId);
          expect(saved1).not.toBeNull();
          expect(saved2).not.toBeNull();
          expect(saved1?.email.toValue()).toBe(verification1.email.toValue());
          expect(saved2?.email.toValue()).toBe(verification2.email.toValue());
        });
      });

      describe('findByUserId', () => {
        it('should find verification by user id', async () => {
          // Arrange
          const verification = EmailVerification.random();
          await repository.save(verification);

          // Act
          const found = await repository.findByUserId(verification.userId);

          // Assert
          expect(found).not.toBeNull();
          expect(found?.id.toValue()).toBe(verification.id.toValue());
          expect(found?.userId.toValue()).toBe(verification.userId.toValue());
        });

        it('should return null when user id not found', async () => {
          // Act
          const found = await repository.findByUserId(Id.random());

          // Assert
          expect(found).toBeNull();
        });
      });

      describe('findByEmail', () => {
        it('should find verification by email', async () => {
          // Arrange
          const verification = EmailVerification.random();
          await repository.save(verification);

          // Act
          const found = await repository.findByEmail(verification.email);

          // Assert
          expect(found).not.toBeNull();
          expect(found?.email.toValue()).toBe(verification.email.toValue());
        });

        it('should return null when email not found', async () => {
          // Act
          const found = await repository.findByEmail(Email.random());

          // Assert
          expect(found).toBeNull();
        });
      });

      describe('findPendingByUserId', () => {
        it('should find pending verification by user id', async () => {
          // Arrange
          const verification = EmailVerification.random({
            verification: Verification.notVerified(),
            expiration: Expiration.atHoursFromNow(1),
          });
          await repository.save(verification);

          // Act
          const found = await repository.findPendingByUserId(verification.userId);

          // Assert
          expect(found).not.toBeNull();
          expect(found?.userId.toValue()).toBe(verification.userId.toValue());
          expect(found?.isVerified()).toBe(false);
        });

        it('should return null for verified verifications', async () => {
          // Arrange
          const verification = EmailVerification.random({
            verification: Verification.verified(),
            expiration: Expiration.atHoursFromNow(1),
          });
          await repository.save(verification);

          // Act
          const found = await repository.findPendingByUserId(verification.userId);

          // Assert
          expect(found).toBeNull();
        });

        it('should return null for expired verifications', async () => {
          // Arrange
          const verification = EmailVerification.random({
            verification: Verification.notVerified(),
            expiration: Expiration.atHoursFromNow(-1),
          });
          await repository.save(verification);

          // Act
          const found = await repository.findPendingByUserId(verification.userId);

          // Assert
          expect(found).toBeNull();
        });
      });

      describe('remove', () => {
        it('should remove verification by id', async () => {
          // Arrange
          const verification = EmailVerification.random();
          await repository.save(verification);

          // Act
          await repository.remove(verification.id);

          // Assert
          const found = await repository.findByUserId(verification.userId);
          expect(found).toBeNull();
        });

        it('should not throw when removing non-existent id', async () => {
          // Act & Assert
          await expect(repository.remove(Id.random())).resolves.not.toThrow();
        });

        it('should only remove specified verification', async () => {
          // Arrange
          const verification1 = EmailVerification.random();
          const verification2 = EmailVerification.random();
          await repository.save(verification1);
          await repository.save(verification2);

          // Act
          await repository.remove(verification1.id);

          // Assert
          const found1 = await repository.findByUserId(verification1.userId);
          const found2 = await repository.findByUserId(verification2.userId);
          expect(found1).toBeNull();
          expect(found2).not.toBeNull();
        });
      });

      describe('exists', () => {
        it('should return true when verification exists', async () => {
          // Arrange
          const verification = EmailVerification.random();
          await repository.save(verification);

          // Act
          const exists = await repository.exists(verification.id);

          // Assert
          expect(exists).toBe(true);
        });

        it('should return false when verification does not exist', async () => {
          // Act
          const exists = await repository.exists(Id.random());

          // Assert
          expect(exists).toBe(false);
        });

        it('should return false after removing verification', async () => {
          // Arrange
          const verification = EmailVerification.random();
          await repository.save(verification);
          await repository.remove(verification.id);

          // Act
          const exists = await repository.exists(verification.id);

          // Assert
          expect(exists).toBe(false);
        });
      });
    });

    describe('Complex Scenarios', () => {
      beforeEach(async () => {
        repository = await createRepository();
      });

      it('should handle verification lifecycle correctly', async () => {
        // Arrange
        const verification = EmailVerification.random();

        // Act & Assert - Initial state
        await repository.save(verification);
        let found = await repository.findById(verification.id);

        expect(found).not.toBeNull();
        expect(found?.isPending()).toBe(true);

        // Act & Assert - After verification
        verification.verify();
        await repository.save(verification);
        found = await repository.findById(verification.id);

        expect(found).not.toBeNull();
        expect(found?.isVerified()).toBe(true);

        // Pending search using user ID should return null after verification
        const pending = await repository.findPendingByUserId(verification.userId);
        expect(pending).toBeNull();
      });

      it('should handle concurrent operations correctly', async () => {
        // Arrange
        const verifications = Array.from({ length: 5 }, () => EmailVerification.random());

        // Act - Save all concurrently
        await Promise.all(verifications.map((v) => repository.save(v)));

        // Assert - All should be saved
        const foundPromises = verifications.map((v) => repository.findByUserId(v.userId));
        const foundVerifications = await Promise.all(foundPromises);

        foundVerifications.forEach((found, index) => {
          expect(found).not.toBeNull();
          expect(found?.userId.toValue()).toBe(verifications[index].userId.toValue());
        });
      });

      it('should maintain data integrity across operations', async () => {
        // Arrange
        const verification = EmailVerification.random();

        // Act - Multiple operations
        await repository.save(verification);
        const exists1 = await repository.exists(verification.id);
        const found1 = await repository.findById(verification.id);

        verification.verify();
        await repository.save(verification);
        const found2 = await repository.findByUserId(verification.userId);

        await repository.remove(verification.id);
        const exists2 = await repository.exists(verification.id);
        const found3 = await repository.findById(verification.id);

        // Assert
        expect(exists1).toBe(true);
        expect(found1).not.toBeNull();
        expect(found2?.isVerified()).toBe(true);
        expect(exists2).toBe(false);
        expect(found3).toBeNull();
      });
    });
  });
}
