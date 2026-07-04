import type { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import type { Email } from '@bc/auth/domain/value-objects';
import type { Id, Repository } from '@libs/nestjs-common';

export const PASSWORD_RESET_REPOSITORY = Symbol('PasswordResetRepository');

export interface PasswordReset_Repository extends Repository<PasswordReset, Id> {
  findByEmail(email: Email): Promise<PasswordReset | null>;
  findValidByEmail(email: Email): Promise<PasswordReset | null>;
}
