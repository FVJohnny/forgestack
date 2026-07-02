import { Base_DomainEvent } from '@libs/nestjs-common';
import type { UserRole, Email } from '@bc/auth/domain/value-objects';
import type { Id } from '@libs/nestjs-common';
import type { AuthProvider } from '@bc/auth/domain/aggregates/user/user.aggregate';

export class UserRegistered_DomainEvent extends Base_DomainEvent {
  constructor(
    public readonly userId: Id,
    public readonly email: Email,
    public readonly role: UserRole,
    // Google verifies the email itself, so users registered via Google must NOT
    // receive the "verify your email" email. Defaults to 'email' for backwards
    // compatibility with previously-persisted events.
    public readonly authProvider: AuthProvider = 'email',
    // When true the email is already considered verified, so the registration
    // flow skips the "verify your email" step and the user can log in directly.
    // This example template ships with verification disabled (see User.create).
    public readonly emailVerified: boolean = false,
  ) {
    super(userId);
  }
}
