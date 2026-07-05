import { AuthenticateWithGoogle_QueryHandler } from './authenticate-with-google.query-handler';
import { AuthenticateWithGoogle_Query } from './authenticate-with-google.query';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { UserStatus } from '@bc/auth/domain/value-objects';
import type {
  GoogleUserInfo,
  IGoogleOAuthService,
} from '@bc/auth/domain/services/google-oauth.interface';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  InfrastructureException,
  JwtTokenService,
  UnauthorizedException,
} from '@libs/nestjs-common';

// Item 191: the Google OAuth query handler had no tests. It gates on the user
// existing (findByGoogleId) and on the domain's canAuthenticate() rule.
class FakeGoogleOAuthService implements IGoogleOAuthService {
  constructor(private readonly info: GoogleUserInfo) {}
  async verifyAccessToken(): Promise<GoogleUserInfo> {
    return this.info;
  }
}

describe('AuthenticateWithGoogle_QueryHandler', () => {
  const GOOGLE_ID = 'google-123';

  const setup = async (
    params: { withUser?: boolean; userStatus?: UserStatus; shouldFailRepository?: boolean } = {},
  ) => {
    const { withUser = false, userStatus = UserStatus.active(), shouldFailRepository = false } =
      params;

    const jwtTokenService = new JwtTokenService(new JwtService());
    const repository = new User_InMemoryRepository(shouldFailRepository);
    const google = new FakeGoogleOAuthService({
      googleId: GOOGLE_ID,
      email: 'g@example.com',
      emailVerified: true,
    });
    const handler = new AuthenticateWithGoogle_QueryHandler(repository, google, jwtTokenService);

    let user: User | null = null;
    if (withUser) {
      user = User.random({ status: userStatus, googleId: GOOGLE_ID });
      await repository.save(user);
    }

    return { repository, jwtTokenService, handler, user };
  };

  const query = () => new AuthenticateWithGoogle_Query({ accessToken: 'valid-token' });

  it('returns tokens for an existing, active Google user', async () => {
    const { handler, user, jwtTokenService } = await setup({ withUser: true });

    const result = await handler.execute(query());

    expect(result.userId).toBe(user!.id.toValue());
    expect(typeof result.accessToken).toBe('string');
    const decoded = jwtTokenService.verifyAccessToken(result.accessToken);
    expect(decoded.userId).toBe(user!.id.toValue());
  });

  it('throws UnauthorizedException when no user has that googleId', async () => {
    const { handler } = await setup({ withUser: false });
    await expect(handler.execute(query())).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the user cannot authenticate (suspended)', async () => {
    const { handler } = await setup({ withUser: true, userStatus: UserStatus.suspended() });
    await expect(handler.execute(query())).rejects.toThrow();
  });

  it('throws BadRequestException when the access token is empty (validate)', async () => {
    const { handler } = await setup({ withUser: true });
    await expect(
      handler.execute(new AuthenticateWithGoogle_Query({ accessToken: '' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws InfrastructureException when the repository fails', async () => {
    const { handler } = await setup({ withUser: false, shouldFailRepository: true });
    await expect(handler.execute(query())).rejects.toThrow(InfrastructureException);
  });
});
