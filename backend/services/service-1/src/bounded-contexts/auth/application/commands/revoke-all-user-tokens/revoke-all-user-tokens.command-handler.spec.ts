import { RevokeAllUserTokens_CommandHandler } from './revoke-all-user-tokens.command-handler';
import { RevokeAllUserTokens_Command } from './revoke-all-user-tokens.command';
import {
  DomainValidationException,
  Id,
  InfrastructureException,
  MockEventBus,
  UserToken_InMemoryRepository,
  UserToken,
  Token,
} from '@libs/nestjs-common';

describe('RevokeAllUserTokens_CommandHandler', () => {
  const createCommand = (overrides: { userId?: string } = {}) =>
    new RevokeAllUserTokens_Command(overrides.userId || Id.random().toValue());

  const setup = async (
    params: {
      withTokens?: boolean;
      shouldFailRepository?: boolean;
      shouldFailEventBus?: boolean;
    } = {},
  ) => {
    const { withTokens = false, shouldFailRepository = false, shouldFailEventBus = false } = params;

    const tokenRepository = new UserToken_InMemoryRepository(shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: shouldFailEventBus });
    const handler = new RevokeAllUserTokens_CommandHandler(tokenRepository, eventBus);

    let userId: Id | null = null;
    const tokens: UserToken[] = [];
    if (withTokens) {
      userId = Id.random();
      // Create multiple tokens for the user
      for (let i = 0; i < 3; i++) {
        const token = UserToken.create({
          userId,
          token: Token.random(),
          type: i % 2 === 0 ? 'access' : 'refresh',
        });
        await tokenRepository.save(token);
        tokens.push(token);
      }
    }

    return { tokenRepository, eventBus, handler, userId, tokens };
  };

  describe('Happy Path', () => {
    it('should successfully revoke all user tokens', async () => {
      // Arrange
      const { handler, userId, tokenRepository } = await setup({ withTokens: true });
      const command = createCommand({ userId: userId!.toValue() });

      // Act
      await handler.execute(command);

      // Assert
      const remainingTokens = await tokenRepository.getUserTokens(userId!);
      expect(remainingTokens).toHaveLength(0);
    });

    it('should handle user with no tokens', async () => {
      // Arrange
      const { handler } = await setup({ withTokens: false });
      const command = createCommand();

      // Act & Assert - Should complete without throwing
      await expect(handler.execute(command)).resolves.not.toThrow();
    });

    it('should only revoke tokens for the specified user', async () => {
      // Arrange
      const { handler, tokenRepository } = await setup({ withTokens: false });

      // Create tokens for two different users
      const token1 = UserToken.create({
        userId: Id.random(),
        token: Token.random(),
        type: 'access',
      });
      const token2 = UserToken.create({
        userId: Id.random(),
        token: Token.random(),
        type: 'access',
      });

      await tokenRepository.save(token1);
      await tokenRepository.save(token2);

      const command = createCommand({ userId: token1.userId.toValue() });

      // Act
      await handler.execute(command);

      // Assert
      const user1Tokens = await tokenRepository.getUserTokens(token1.userId);
      const user2Tokens = await tokenRepository.getUserTokens(token2.userId);

      expect(user1Tokens).toHaveLength(0);
      expect(user2Tokens).toHaveLength(1);
    });
  });

  describe('Error Cases', () => {
    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { handler } = await setup({
        withTokens: false,
        shouldFailRepository: true,
      });
      const command = createCommand();

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(InfrastructureException);
    });
  });

  describe('Input Validation', () => {
    it('should handle empty userId', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new RevokeAllUserTokens_Command('');

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should handle invalid userId format', async () => {
      // Arrange
      const { handler } = await setup();
      const command = new RevokeAllUserTokens_Command('invalid-id');

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent revoke attempts for the same user', async () => {
      // Arrange
      const { handler, userId } = await setup({ withTokens: true });
      const command = createCommand({ userId: userId!.toValue() });

      // Act - Execute multiple commands concurrently
      const results = await Promise.allSettled([
        handler.execute(command),
        handler.execute(command),
        handler.execute(command),
      ]);

      // Assert - All should succeed
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });
});
