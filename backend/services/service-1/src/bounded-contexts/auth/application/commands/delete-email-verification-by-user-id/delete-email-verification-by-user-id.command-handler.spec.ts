import { DeleteEmailVerificationByUserId_CommandHandler } from './delete-email-verification-by-user-id.command-handler';
import { DeleteEmailVerificationByUserId_Command } from './delete-email-verification-by-user-id.command';
import { EmailVerification_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/email-verification.in-memory-repository';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { Id, MockEventBus, InfrastructureException } from '@libs/nestjs-common';

describe('DeleteEmailVerificationByUserId_CommandHandler', () => {
  const createCommand = ({ userId }: { userId?: string } = {}) =>
    new DeleteEmailVerificationByUserId_Command({ userId: userId ?? Id.random().toValue() });

  const setup = async (
    params: {
      withVerification?: boolean;
      shouldFailRepository?: boolean;
      shouldFailEventBus?: boolean; // currently not used but keeps parity
    } = {},
  ) => {
    const {
      withVerification = false,
      shouldFailRepository = false,
      shouldFailEventBus = false,
    } = params;

    const repository = new EmailVerification_InMemoryRepository(shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const handler = new DeleteEmailVerificationByUserId_CommandHandler(repository, eventBus);

    let verification: EmailVerification | null = null;
    if (withVerification && !shouldFailRepository) {
      verification = EmailVerification.random();
      await repository.save(verification);
    }

    return { repository, eventBus, handler, verification };
  };

  describe('Happy Path', () => {
    it('should delete the verification for the given user', async () => {
      const { handler, repository, verification } = await setup({ withVerification: true });
      const command = createCommand({ userId: verification!.userId.toValue() });

      await handler.execute(command);

      expect(await repository.findById(verification!.id)).toBeNull();
      expect(await repository.findByUserId(verification!.userId)).toBeNull();
    });
  });

  describe('Error cases', () => {
    it('should not throw exceptions when no verification exists for the user', async () => {
      const { handler } = await setup();
      const command = createCommand();

      await expect(handler.execute(command)).resolves.not.toThrow();
    });

    it('should throw InfrastructureException when repository fails', async () => {
      const { handler } = await setup({ shouldFailRepository: true });

      const command = createCommand();

      await expect(handler.execute(command)).rejects.toThrow(InfrastructureException);
    });
  });
});
