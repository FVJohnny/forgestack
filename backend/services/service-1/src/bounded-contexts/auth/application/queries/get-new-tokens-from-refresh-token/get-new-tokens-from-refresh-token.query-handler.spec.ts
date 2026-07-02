import { GetNewTokensFromRefreshToken_QueryHandler } from './get-new-tokens-from-refresh-token.query-handler';
import { GetNewTokensFromRefreshToken_Query } from './get-new-tokens-from-refresh-token.query';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  UserToken,
  Token,
  UserToken_InMemoryRepository,
  Id,
  JwtTokenService,
  UnauthorizedException,
} from '@libs/nestjs-common';
import { Email, UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import type { TokenPayload } from '@libs/nestjs-common';
import { JwtService } from '@nestjs/jwt';

describe('GetNewTokensFromRefreshToken_QueryHandler', () => {
  const setup = async (
    params: {
      withUser?: boolean;
      userStatus?: 'active' | 'inactive';
      shouldFailRepository?: boolean;
      withSavedToken?: boolean;
    } = {},
  ) => {
    const {
      withUser = false,
      userStatus = 'active',
      shouldFailRepository = false,
      withSavedToken = false,
    } = params;

    const userRepository = new User_InMemoryRepository(shouldFailRepository);
    const userTokenRepository = new UserToken_InMemoryRepository(shouldFailRepository);
    const jwtTokenService = new JwtTokenService(new JwtService());
    const handler = new GetNewTokensFromRefreshToken_QueryHandler(
      userRepository,
      userTokenRepository,
      jwtTokenService,
    );

    let user: User | null = null;
    let refreshToken: string | null = null;

    if (withUser) {
      user = User.random({
        id: Id.random(),
        status: userStatus === 'active' ? UserStatus.active() : UserStatus.inactive(),
      });
      await userRepository.save(user);

      // Generate refresh token for this user
      const payload: TokenPayload = {
        userId: user.id.toValue(),
        email: user.email.toValue(),
        role: user.role.toValue(),
      };
      refreshToken = jwtTokenService.generateRefreshToken(payload);

      // Only save token if withSavedToken is true
      if (withSavedToken) {
        const userToken = UserToken.create({
          userId: user.id,
          token: new Token(refreshToken),
          type: 'refresh',
        });
        await userTokenRepository.save(userToken);
      }
    }

    return { userRepository, userTokenRepository, jwtTokenService, handler, user, refreshToken };
  };

  it('should successfully refresh tokens for valid and stored refresh token', async () => {
    // Arrange
    const { handler, user, jwtTokenService, refreshToken } = await setup({
      withUser: true,
      userStatus: 'active',
      withSavedToken: true,
    });

    const query = new GetNewTokensFromRefreshToken_Query(refreshToken!);

    // Act
    const result = await handler.execute(query);

    // Assert
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    const decodedAccessToken = jwtTokenService.verifyAccessToken(result.accessToken);
    expect(decodedAccessToken.userId).toBe(user?.id.toValue());
    expect(decodedAccessToken.email).toBe(user?.email.toValue());
    expect(decodedAccessToken.role).toBe(user?.role.toValue());

    const decodedRefreshToken = jwtTokenService.verifyRefreshToken(result.refreshToken);
    expect(decodedRefreshToken.userId).toBe(user?.id.toValue());
    expect(decodedRefreshToken.email).toBe(user?.email.toValue());
    expect(decodedRefreshToken.role).toBe(user?.role.toValue());
  });

  it('should throw UnauthorizedException for empty refresh token', async () => {
    // Arrange
    const { handler } = await setup();
    const query = new GetNewTokensFromRefreshToken_Query('');

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for invalid refresh token', async () => {
    // Arrange
    const { handler } = await setup({});
    const query = new GetNewTokensFromRefreshToken_Query('invalid-refresh-token');

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user not found', async () => {
    // Arrange
    const { handler, jwtTokenService } = await setup({});
    const payload: TokenPayload = {
      userId: Id.random().toValue(),
      email: Email.random().toValue(),
      role: UserRole.random().toValue(),
    };
    const refreshToken = jwtTokenService.generateRefreshToken(payload);
    const query = new GetNewTokensFromRefreshToken_Query(refreshToken);

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user is inactive', async () => {
    // Arrange
    const { handler, refreshToken } = await setup({
      withUser: true,
      userStatus: 'inactive',
      withSavedToken: true,
    });

    const query = new GetNewTokensFromRefreshToken_Query(refreshToken!);

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token is not saved in repository', async () => {
    // Arrange
    const { handler, refreshToken } = await setup({
      withUser: true,
      userStatus: 'active',
      withSavedToken: false,
    });

    const query = new GetNewTokensFromRefreshToken_Query(refreshToken!);

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UnauthorizedException);
  });
});
