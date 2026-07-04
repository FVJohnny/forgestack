import { Inject } from '@nestjs/common';
import { GetNewTokensFromRefreshToken_Query } from './get-new-tokens-from-refresh-token.query';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_QueryHandler,
  UnauthorizedException,
  JwtTokenService,
  Id,
  TokenPayload,
} from '@libs/nestjs-common';
import { GetNewTokensFromRefreshToken_QueryResponse } from './get-new-tokens-from-refresh-token.query-response';
import { USER_TOKEN_REPOSITORY, type UserToken_Repository, Token } from '@libs/nestjs-common';

export class GetNewTokensFromRefreshToken_QueryHandler extends Base_QueryHandler(
  GetNewTokensFromRefreshToken_Query,
)<GetNewTokensFromRefreshToken_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(USER_TOKEN_REPOSITORY)
    private readonly userTokenRepository: UserToken_Repository,
    private readonly jwtTokenService: JwtTokenService,
  ) {
    super();
  }

  async handle(
    query: GetNewTokensFromRefreshToken_Query,
  ): Promise<GetNewTokensFromRefreshToken_QueryResponse> {
    let userId: string;

    // Decode refresh token
    try {
      const decoded = this.jwtTokenService.verifyRefreshToken(query.refreshToken);
      userId = decoded.userId;
    } catch {
      throw new UnauthorizedException();
    }

    // Check if user exists
    const user = await this.userRepository.findById(new Id(userId));
    if (!user) {
      throw new UnauthorizedException();
    }

    // Check user can authenticate
    user.canAuthenticate();

    // Check the token exists in repository
    const userToken = await this.userTokenRepository.findByToken(new Token(query.refreshToken));
    if (!userToken) {
      throw new UnauthorizedException();
    }

    // Generate new JWT tokens
    const payload: TokenPayload = {
      userId: user.id.toValue(),
      email: user.email.toValue(),
      role: user.role.toValue(),
    };

    const accessToken = this.jwtTokenService.generateAccessToken(payload);
    const refreshToken = this.jwtTokenService.generateRefreshToken(payload);

    return {
      userId,
      accessToken,
      refreshToken,
    };
  }

  async authorize(_query: GetNewTokensFromRefreshToken_Query) {
    return true;
  }

  async validate(_query: GetNewTokensFromRefreshToken_Query) {
    // Refresh token must not be empty
    if (!_query.refreshToken || _query.refreshToken.trim().length === 0) {
      throw new UnauthorizedException();
    }
  }
}
