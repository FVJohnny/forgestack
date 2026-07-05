import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_QueryHandler,
  Id,
  JwtTokenService,
  NotFoundException,
  UnauthorizedException,
  TokenPayload,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { GetNewTokensFromEmailVerification_Query } from './get-new-tokens-from-email-verification.query';
import { GetNewTokensFromEmailVerification_QueryResponse } from './get-new-tokens-from-email-verification.query-response';

export class GetNewTokensFromEmailVerification_QueryHandler extends Base_QueryHandler(
  GetNewTokensFromEmailVerification_Query,
)<GetNewTokensFromEmailVerification_QueryResponse>() {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    private readonly jwtTokenService: JwtTokenService,
  ) {
    super();
  }

  async handle(
    query: GetNewTokensFromEmailVerification_Query,
  ): Promise<GetNewTokensFromEmailVerification_QueryResponse> {
    const emailVerification = await this.emailVerificationRepository.findById(
      new Id(query.emailVerificationId),
    );
    if (!emailVerification) {
      throw new NotFoundException('email verification');
    }

    // Defense in depth: this handler mints login tokens, so possessing a
    // verification id must not be enough on its own. Only mint for a
    // verification that has actually been verified and has not expired. Today
    // the controller runs VerifyEmail_Command first (which enforces this), but
    // this guards against a future caller or a reordering minting tokens from a
    // merely-existing (unverified or expired) verification.
    if (emailVerification.isExpired() || !emailVerification.isVerified()) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findById(emailVerification.userId);
    if (!user) {
      throw new NotFoundException('user');
    }

    const payload: TokenPayload = {
      userId: user.id.toValue(),
      email: user.email.toValue(),
      role: user.role.toValue(),
    };

    return {
      userId: user.id.toValue(),
      accessToken: this.jwtTokenService.generateAccessToken(payload),
      refreshToken: this.jwtTokenService.generateRefreshToken(payload),
    };
  }

  async authorize(_query: GetNewTokensFromEmailVerification_Query) {
    // Public flow: possessing a valid email verification id is the credential
    return true;
  }

  async validate(query: GetNewTokensFromEmailVerification_Query) {
    new Id(query.emailVerificationId);
  }
}
