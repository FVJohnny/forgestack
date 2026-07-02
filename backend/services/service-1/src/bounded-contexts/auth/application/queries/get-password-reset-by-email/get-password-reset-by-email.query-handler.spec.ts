import { GetPasswordResetByEmail_QueryHandler } from './get-password-reset-by-email.query-handler';
import { GetPasswordResetByEmail_Query } from './get-password-reset-by-email.query';
import { PasswordReset_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/password-reset.in-memory-repository';
import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { NotFoundException, InfrastructureException } from '@libs/nestjs-common';
import { Email } from '@bc/auth/domain/value-objects';
import { PasswordResetUniquenessChecker_Mock } from '@bc/auth/domain/services/password-reset-uniqueness-checker.mock';

describe('GetPasswordResetByEmail_QueryHandler', () => {
  const createQuery = (overrides: Partial<GetPasswordResetByEmail_Query> = {}) =>
    new GetPasswordResetByEmail_Query({
      email: Email.random().toValue(),
      ...overrides,
    });

  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const { shouldFailRepository = false } = params;

    const passwordResetUniquenessChecker = new PasswordResetUniquenessChecker_Mock();
    const repository = new PasswordReset_InMemoryRepository(shouldFailRepository);
    const handler = new GetPasswordResetByEmail_QueryHandler(repository);

    return { passwordResetUniquenessChecker, repository, handler };
  };

  it('should return the password reset DTO when password reset exists', async () => {
    // Arrange
    const { handler, repository, passwordResetUniquenessChecker } = setup();
    const passwordReset = await PasswordReset.create(
      { email: Email.random() },
      passwordResetUniquenessChecker,
    );
    await repository.save(passwordReset);

    const query = createQuery({ email: passwordReset.email.toValue() });

    // Act
    const result = await handler.execute(query);

    // Assert
    expect(result).toBeDefined();
    expect(result).toEqual(passwordReset.toValue());
  });

  it('should throw NotFoundException when password reset does not exist', async () => {
    // Arrange
    const { handler } = setup();
    const query = createQuery();

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should throw InfrastructureException if repository fails', async () => {
    // Arrange
    const { handler } = setup({ shouldFailRepository: true });
    const query = createQuery();

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(InfrastructureException);
  });

  it('should return the correct password reset for a specific email', async () => {
    // Arrange
    const { handler, repository, passwordResetUniquenessChecker } = setup();

    // Create multiple password resets
    const passwordReset1 = await PasswordReset.create(
      { email: Email.random() },
      passwordResetUniquenessChecker,
    );
    const passwordReset2 = await PasswordReset.create(
      { email: Email.random() },
      passwordResetUniquenessChecker,
    );
    const passwordReset3 = await PasswordReset.create(
      { email: Email.random() },
      passwordResetUniquenessChecker,
    );

    await repository.save(passwordReset1);
    await repository.save(passwordReset2);
    await repository.save(passwordReset3);

    const query = createQuery({ email: passwordReset2.email.toValue() });

    // Act
    const result = await handler.execute(query);

    // Assert
    expect(result).toBeDefined();
    expect(result).toEqual(passwordReset2.toValue());
  });
});
