import type { Email } from '@bc/auth/domain/value-objects';
import type { IUserUniquenessChecker } from './user-uniqueness-checker.interface';

/**
 * Mock implementation of UserUniquenessChecker for testing.
 * Simple stub that returns configured boolean values.
 */
export class UserUniquenessChecker_Mock implements IUserUniquenessChecker {
  constructor(private readonly emailIsUnique: boolean = true) {}

  async isEmailUnique(_email: Email): Promise<boolean> {
    return this.emailIsUnique;
  }
}
