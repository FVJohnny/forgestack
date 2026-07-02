import type { Email } from '@bc/auth/domain/value-objects';
import type { IPasswordResetUniquenessChecker } from './password-reset-uniqueness-checker.interface';

export class PasswordResetUniquenessChecker_Mock implements IPasswordResetUniquenessChecker {
  constructor(private readonly canCreate: boolean = true) {}

  async canCreateNew(_email: Email): Promise<boolean> {
    return this.canCreate;
  }
}
