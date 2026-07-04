import { GetNewTokensFromEmailVerification_QueryHandler } from './get-new-tokens-from-email-verification.query-handler';
import { GetNewTokensFromEmailVerification_Query } from './get-new-tokens-from-email-verification.query';
import { EmailVerification_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/email-verification.in-memory-repository';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { JwtService } from '@nestjs/jwt';
import { Id, JwtTokenService, NotFoundException } from '@libs/nestjs-common';

describe('GetNewTokensFromEmailVerification_QueryHandler', () => {
  const setup = async (
    params: {
      withEmailVerification?: boolean;
      withUser?: boolean;
      shouldFailRepository?: boolean;
    } = {},
  ) => {
    const { withEmailVerification = true, withUser = true, shouldFailRepository = false } = params;

    const jwtTokenService = new JwtTokenService(new JwtService());
    const emailVerificationRepository = new EmailVerification_InMemoryRepository(
      shouldFailRepository,
    );
    const userRepository = new User_InMemoryRepository();
    const handler = new GetNewTokensFromEmailVerification_QueryHandler(
      emailVerificationRepository,
      userRepository,
      jwtTokenService,
    );

    const user = User.random();
    if (withUser) {
      await userRepository.save(user);
    }

    const emailVerification = EmailVerification.random({ userId: user.id, email: user.email });
    if (withEmailVerification) {
      await emailVerificationRepository.save(emailVerification);
    }

    return { handler, user, emailVerification, jwtTokenService };
  };

  describe('Happy Path', () => {
    it('should return tokens for the user behind the email verification', async () => {
      // Arrange
      const { handler, user, emailVerification, jwtTokenService } = await setup();
      const query = new GetNewTokensFromEmailVerification_Query({
        emailVerificationId: emailVerification.id.toValue(),
      });

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.userId).toBe(user.id.toValue());
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');

      // Verify access token contains correct payload
      const decodedAccessToken = jwtTokenService.verifyAccessToken(result.accessToken);
      expect(decodedAccessToken.userId).toBe(user.id.toValue());
      expect(decodedAccessToken.email).toBe(user.email.toValue());
      expect(decodedAccessToken.role).toBe(user.role.toValue());

      // Verify refresh token contains correct payload
      const decodedRefreshToken = jwtTokenService.verifyRefreshToken(result.refreshToken);
      expect(decodedRefreshToken.userId).toBe(user.id.toValue());
    });
  });

  describe('Not Found', () => {
    it('should throw NotFoundException when the email verification does not exist', async () => {
      // Arrange
      const { handler } = await setup({ withEmailVerification: false });
      const query = new GetNewTokensFromEmailVerification_Query({
        emailVerificationId: Id.random().toValue(),
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      // Arrange
      const { handler, emailVerification } = await setup({ withUser: false });
      const query = new GetNewTokensFromEmailVerification_Query({
        emailVerificationId: emailVerification.id.toValue(),
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate repository failures', async () => {
      // Arrange (skip seeding: every operation on the failing repository throws)
      const { handler } = await setup({
        shouldFailRepository: true,
        withEmailVerification: false,
      });
      const query = new GetNewTokensFromEmailVerification_Query({
        emailVerificationId: Id.random().toValue(),
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow();
    });
  });
});
