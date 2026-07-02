import { Inject, ForbiddenException } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { ImpersonateUser_Query } from './impersonate-user.query';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_QueryHandler,
  Id,
  NotFoundException,
  JwtTokenService,
  type TokenPayload,
  COMMAND_BUS,
  StoreTokens_Command,
} from '@libs/nestjs-common';
import { ImpersonateUser_QueryResponse } from './impersonate-user.query-response';

export class ImpersonateUser_QueryHandler extends Base_QueryHandler(
  ImpersonateUser_Query,
)<ImpersonateUser_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    private readonly jwtTokenService: JwtTokenService,
    @Inject(COMMAND_BUS)
    private readonly commandBus: ICommandBus,
  ) {
    super();
  }

  async handle(query: ImpersonateUser_Query): Promise<ImpersonateUser_QueryResponse> {
    const targetUser = await this.userRepository.findById(new Id(query.targetUserId));

    if (!targetUser) {
      throw new NotFoundException('User', query.targetUserId);
    }

    // Prevent impersonating other admins
    if (targetUser.role.toValue() === 'admin') {
      throw new ForbiddenException('Cannot impersonate admin users');
    }

    // Log impersonation for audit trail
    this.logger.warn(
      `ADMIN IMPERSONATION: adminId=${query.adminUserId}, adminEmail=${query.adminEmail}, ` +
        `targetId=${query.targetUserId}, targetEmail=${targetUser.email.toValue()}`,
    );

    // Create impersonation token payload
    const tokenPayload: TokenPayload = {
      userId: targetUser.id.toValue(),
      email: targetUser.email.toValue(),
      role: targetUser.role.toValue(),
      isImpersonating: true,
      originalUserId: query.adminUserId,
      originalEmail: query.adminEmail,
    };

    // Generate tokens with shorter expiry for impersonation
    const accessToken = this.jwtTokenService.generateImpersonationAccessToken(tokenPayload);
    const refreshToken = this.jwtTokenService.generateImpersonationRefreshToken(tokenPayload);

    // Store tokens in Redis so they can be validated by the auth guard
    await this.commandBus.execute(
      new StoreTokens_Command({
        userId: targetUser.id.toValue(),
        accessToken,
        refreshToken,
      }),
    );

    return {
      accessToken,
      refreshToken,
      userId: targetUser.id.toValue(),
      impersonatedEmail: targetUser.email.toValue(),
    };
  }

  async authorize(_query: ImpersonateUser_Query) {
    return true;
  }

  async validate(_query: ImpersonateUser_Query) {}
}
