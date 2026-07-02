import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import { PasswordReset_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/password-reset.in-memory-repository';
import { Id, Timestamps } from '@libs/nestjs-common';
import { PasswordResetUniquenessChecker } from './password-reset-uniqueness-checker.service';

describe('PasswordResetUniquenessChecker', () => {
  const setup = () => {
    const passwordResetRepository = new PasswordReset_InMemoryRepository();
    const checker = new PasswordResetUniquenessChecker(passwordResetRepository);
    return { passwordResetRepository, checker };
  };

  it('should allow creating a new reset when none exists for this email', async () => {
    const { checker } = setup();

    const result = await checker.canCreateNew(Email.random());

    expect(result).toBe(true);
  });

  it('should deny creating a new reset when an active (usable) one exists', async () => {
    const { passwordResetRepository, checker } = setup();
    const email = Email.random();

    // Create a usable password reset (not expired, not used)
    const activeReset = new PasswordReset({
      id: Id.random(),
      email,
      expiration: Expiration.atHoursFromNow(1),
      used: Used.no(),
      timestamps: Timestamps.create(),
    });
    await passwordResetRepository.save(activeReset);

    const result = await checker.canCreateNew(email);

    expect(result).toBe(false);
  });

  it('should allow creating a new reset when existing one is already used', async () => {
    const { passwordResetRepository, checker } = setup();
    const email = Email.random();

    // Create a used password reset
    const usedReset = new PasswordReset({
      id: Id.random(),
      email,
      expiration: Expiration.atHoursFromNow(1),
      used: Used.yes(),
      timestamps: Timestamps.create(),
    });
    await passwordResetRepository.save(usedReset);

    const result = await checker.canCreateNew(email);

    expect(result).toBe(true);
  });

  it('should allow creating a new reset when existing one is expired', async () => {
    const { passwordResetRepository, checker } = setup();
    const email = Email.random();

    // Create an expired password reset (expiration in the past)
    const expiredReset = new PasswordReset({
      id: Id.random(),
      email,
      expiration: new Expiration(new Date(Date.now() - 3600_000)), // 1 hour ago
      used: Used.no(),
      timestamps: Timestamps.create(),
    });
    await passwordResetRepository.save(expiredReset);

    const result = await checker.canCreateNew(email);

    expect(result).toBe(true);
  });

  it('should not be affected by resets for different emails', async () => {
    const { passwordResetRepository, checker } = setup();
    const email1 = Email.random();
    const email2 = Email.random();

    // Create an active reset for email1
    const activeReset = new PasswordReset({
      id: Id.random(),
      email: email1,
      expiration: Expiration.atHoursFromNow(1),
      used: Used.no(),
      timestamps: Timestamps.create(),
    });
    await passwordResetRepository.save(activeReset);

    // email2 should still be allowed
    const result = await checker.canCreateNew(email2);
    expect(result).toBe(true);
  });
});
