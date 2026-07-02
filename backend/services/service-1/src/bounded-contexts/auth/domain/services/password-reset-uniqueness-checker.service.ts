import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordReset_Repository,
} from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import type { Email } from '@bc/auth/domain/value-objects';
import { Inject, Injectable } from '@nestjs/common';
import type { IPasswordResetUniquenessChecker } from './password-reset-uniqueness-checker.interface';

/**
 * Domain service for checking password reset uniqueness.
 */
@Injectable()
export class PasswordResetUniquenessChecker implements IPasswordResetUniquenessChecker {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: PasswordReset_Repository,
  ) {}

  async canCreateNew(email: Email): Promise<boolean> {
    const existing = await this.passwordResetRepository.findByEmail(email);

    // Can create new if:
    // 1. No existing password reset exists, OR
    // 2. Existing one is not usable (expired or already used)
    return !existing || !existing.canBeUsed();
  }
}
