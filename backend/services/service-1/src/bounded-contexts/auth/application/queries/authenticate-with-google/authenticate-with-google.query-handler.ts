import { Inject, BadRequestException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_QueryHandler,
  JwtTokenService,
  TokenPayload,
  UnauthorizedException,
} from '@libs/nestjs-common';
import {
  GOOGLE_OAUTH_SERVICE,
  type IGoogleOAuthService,
} from '@bc/auth/domain/services/google-oauth.interface';
import { AuthenticateWithGoogle_Query } from './authenticate-with-google.query';
import { AuthenticateWithGoogle_QueryResponse } from './authenticate-with-google.query-response';

export class AuthenticateWithGoogle_QueryHandler extends Base_QueryHandler(
  AuthenticateWithGoogle_Query,
)<AuthenticateWithGoogle_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(GOOGLE_OAUTH_SERVICE)
    private readonly googleOAuthService: IGoogleOAuthService,
    private readonly jwtTokenService: JwtTokenService,
  ) {
    super();
  }

  async handle(query: AuthenticateWithGoogle_Query): Promise<AuthenticateWithGoogle_QueryResponse> {
    const googleUserInfo = await this.googleOAuthService.verifyAccessToken(query.accessToken);

    // Find user by Google ID (must exist — command should have been called first)
    const user = await this.userRepository.findByGoogleId(googleUserInfo.googleId);

    if (!user) {
      throw new UnauthorizedException();
    }

    // Domain enforces business rule: only active users can authenticate
    user.canAuthenticate();

    const payload: TokenPayload = {
      userId: user.id.toValue(),
      email: user.email.toValue(),
      role: user.role.toValue(),
    };

    const accessToken = this.jwtTokenService.generateAccessToken(payload);
    const refreshToken = this.jwtTokenService.generateRefreshToken(payload);

    return {
      userId: user.id.toValue(),
      accessToken,
      refreshToken,
    };
  }

  async authorize(_query: AuthenticateWithGoogle_Query) {
    return true;
  }

  async validate(query: AuthenticateWithGoogle_Query) {
    if (!query.accessToken || query.accessToken.trim().length === 0) {
      throw new BadRequestException('Google access token is required');
    }
  }
}
