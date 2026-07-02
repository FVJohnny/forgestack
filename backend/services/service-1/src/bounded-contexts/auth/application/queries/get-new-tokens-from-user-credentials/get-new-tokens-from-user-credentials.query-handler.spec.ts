import { GetNewTokensFromUserCredentials_QueryHandler } from './get-new-tokens-from-user-credentials.query-handler';
import { GetNewTokensFromUserCredentials_Query } from './get-new-tokens-from-user-credentials.query';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Email, Password, UserStatus } from '@bc/auth/domain/value-objects';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  InfrastructureException,
  DomainValidationException,
  JwtTokenService,
} from '@libs/nestjs-common';

describe('GetNewTokensFromUserCredentials_QueryHandler', () => {
  const createQuery = (overrides: Partial<GetNewTokensFromUserCredentials_Query> = {}) =>
    new GetNewTokensFromUserCredentials_Query({
      email: overrides.email || Email.random().toValue(),
      password: overrides.password || Password.random().toValue(),
    });

  const setup = async (
    params: {
      withUser?: boolean;
      userStatus?: UserStatus;
      shouldFailRepository?: boolean;
    } = {},
  ) => {
    const {
      withUser = false,
      userStatus = UserStatus.active(),
      shouldFailRepository = false,
    } = params;

    // Create real JWT service
    const jwtTokenService = new JwtTokenService(new JwtService());
    const repository = new User_InMemoryRepository(shouldFailRepository);
    const handler = new GetNewTokensFromUserCredentials_QueryHandler(repository, jwtTokenService);

    let user: User | null = null;
    if (withUser) {
      user = User.random({
        status: userStatus,
        password: await Password.createFromPlainText('password123'),
      });
      await repository.save(user);
    }

    return { repository, jwtTokenService, handler, user };
  };

  describe('Happy Path', () => {
    it('should return tokens for valid credentials', async () => {
      // Arrange
      const { handler, user, jwtTokenService } = await setup({ withUser: true });

      const query = createQuery({
        email: user!.email.toValue(),
        password: 'password123',
      });

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.userId).toBe(user!.id.toValue());
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');

      // Verify access token contains correct payload
      const decodedAccessToken = jwtTokenService.verifyAccessToken(result.accessToken);
      expect(decodedAccessToken.userId).toBe(user!.id.toValue());
      expect(decodedAccessToken.email).toBe(user!.email.toValue());
      expect(decodedAccessToken.role).toBe(user!.role.toValue());

      // Verify refresh token contains correct payload
      const decodedRefreshToken = jwtTokenService.verifyRefreshToken(result.refreshToken);
      expect(decodedRefreshToken.userId).toBe(user!.id.toValue());
    });
  });

  describe('Authentication Failures', () => {
    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      const { handler } = await setup({ withUser: false });
      const query = createQuery();

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      // Arrange
      const { handler, user } = await setup({ withUser: true });
      const query = createQuery({
        email: user!.email.toValue(),
        password: 'WrongPassword456!',
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        userStatus: UserStatus.inactive(),
      });
      const query = createQuery({
        email: user!.email.toValue(),
        password: 'password123',
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is email verification pending', async () => {
      // Arrange
      const { handler, user } = await setup({
        withUser: true,
        userStatus: UserStatus.emailVerificationPending(),
      });
      const query = createQuery({
        email: user!.email.toValue(),
        password: 'password123',
      });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Input Validation', () => {
    it('should throw UnauthorizedException for empty password', async () => {
      // Arrange
      const { handler } = await setup();
      const query = createQuery({ password: '' });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw DomainValidationException for invalid email format', async () => {
      // Arrange
      const { handler } = await setup();
      const query = createQuery({ email: 'invalid-email' });

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(DomainValidationException);
    });
  });

  describe('Error Cases', () => {
    it('should throw InfrastructureException when repository fails', async () => {
      // Arrange
      const { handler } = await setup({ shouldFailRepository: true });
      const query = createQuery();

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(InfrastructureException);
    });
  });
});
