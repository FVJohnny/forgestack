import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Email } from '@bc/auth/domain/value-objects';
import {
  Base_QueryHandler,
  JwtTokenService,
  TokenPayload,
  UnauthorizedException,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { GetNewTokensFromUserCredentials_Query } from './get-new-tokens-from-user-credentials.query';
import { GetNewTokensFromUserCredentials_QueryResponse } from './get-new-tokens-from-user-credentials.query-response';

export class GetNewTokensFromUserCredentials_QueryHandler extends Base_QueryHandler(
  GetNewTokensFromUserCredentials_Query,
)<GetNewTokensFromUserCredentials_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    private readonly jwtTokenService: JwtTokenService,
  ) {
    super();
  }

  async handle(
    query: GetNewTokensFromUserCredentials_Query,
  ): Promise<GetNewTokensFromUserCredentials_QueryResponse> {
    const email = new Email(query.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user) throw new UnauthorizedException();

    // Verify password
    const isPasswordValid = await user.password.verify(query.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    // Domain enforces business rule: only active users can authenticate
    user.canAuthenticate();

    // Generate JWT tokens
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

  async authorize(_query: GetNewTokensFromUserCredentials_Query) {
    // Login doesn't require additional authorization - authentication is done in handle()
    return true;
  }

  async validate(query: GetNewTokensFromUserCredentials_Query) {
    // Validate email format
    new Email(query.email);

    // Basic password validation
    if (!query.password || query.password.trim().length === 0) {
      throw new UnauthorizedException();
    }
  }
}
