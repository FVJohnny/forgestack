import type { Email } from '@bc/auth/domain/value-objects';

/**
 * Domain service interface for checking password reset uniqueness.
 */
export const PASSWORD_RESET_UNIQUENESS_CHECKER = Symbol('PasswordResetUniquenessChecker');

export interface IPasswordResetUniquenessChecker {
  /**
   * Checks if a new password reset can be created for this email.
   */
  canCreateNew(email: Email): Promise<boolean>;
}
