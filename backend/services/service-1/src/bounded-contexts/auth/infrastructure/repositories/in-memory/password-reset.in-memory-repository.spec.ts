import { PasswordReset_InMemoryRepository } from './password-reset.in-memory-repository';
import { testPasswordResetRepositoryContract } from '@bc/auth/domain/aggregates/password-reset/password-reset.repository.spec';
import type { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';

// Run the shared contract tests for in-memory implementation
testPasswordResetRepositoryContract(
  'In-Memory Implementation',
  async (passwordResets?: PasswordReset[]) => {
    const repository = new PasswordReset_InMemoryRepository();
    passwordResets?.forEach((passwordReset) => repository.save(passwordReset));
    return repository;
  },
);
