import { VerifyUserEmail_CommandHandler } from './verify-user-email.command-handler';
import { VerifyUserEmail_Command } from './verify-user-email.command';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  Id,
  InfrastructureException,
  NotFoundException,
  InvalidOperationException,
} from '@libs/nestjs-common';
import { UserStatus } from '@bc/auth/domain/value-objects';

describe('VerifyUserEmail_CommandHandler', () => {
  const createCommand = ({ userId }: { userId?: string } = {}) =>
    new VerifyUserEmail_Command(userId ?? Id.random().toValue());

  const setup = async (
    params: {
      withUser?: boolean;
      userStatus?: UserStatus;
      shouldFailRepository?: boolean;
    } = {},
  ) => {
    const { withUser = false, userStatus, shouldFailRepository = false } = params;

    const repository = new User_InMemoryRepository(shouldFailRepository);
    const handler = new VerifyUserEmail_CommandHandler(repository);

    let user: User | null = null;
    if (withUser) {
      user = User.random({ status: userStatus });
      await repository.save(user);
    }

    return { repository, handler, user };
  };

  describe('Happy Path', () => {
    it('should verify email for user with EMAIL_VERIFICATION_PENDING status', async () => {
      // Arrange
      const { handler, repository, user } = await setup({
        withUser: true,
        userStatus: UserStatus.emailVerificationPending(),
      });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act
      await handler.execute(command);

      // Assert
      const updatedUser = await repository.findById(user!.id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.status.toValue()).toBe('active');
      expect(updatedUser!.isActive()).toBe(true);
      expect(updatedUser!.isEmailVerificationPending()).toBe(false);
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const { handler } = await setup();
      const command = createCommand();

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { handler } = await setup({ shouldFailRepository: true });
      const command = createCommand();

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(InfrastructureException);
    });

    it('should throw InvalidOperationException when user status is ACTIVE', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        userStatus: UserStatus.active(),
      });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(InvalidOperationException);
    });

    it('should throw InvalidOperationException when user status is INACTIVE', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        userStatus: UserStatus.inactive(),
      });
      const command = createCommand({ userId: user!.id.toValue() });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(InvalidOperationException);
    });
  });
});
