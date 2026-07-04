import type { Email } from '@bc/auth/domain/value-objects';

/**
 * Domain service interface for checking user uniqueness constraints.
 * This enforces the business rule that emails must be unique.
 */
export const USER_UNIQUENESS_CHECKER = Symbol('UserUniquenessChecker');

export interface IUserUniquenessChecker {
  /**
   * Checks if the given email is unique (not already taken by another user)
   * @param email - The email to check
   * @returns true if email is unique, false if already exists
   */
  isEmailUnique(email: Email): Promise<boolean>;
}
