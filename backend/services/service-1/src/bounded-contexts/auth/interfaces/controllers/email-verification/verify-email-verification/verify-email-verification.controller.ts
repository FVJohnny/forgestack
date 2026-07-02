import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { VerifyEmail_Command } from '@bc/auth/application/commands';
import { VerifyEmailRequestDto } from './verify-email-verification.params';
import { VerifyEmail_ResponseDto } from './verify-email-verification.controller-response';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  PublicApi,
  StrictRateLimit,
  Id,
  NotFoundException,
  JwtTokenService,
  TokenPayload,
  StoreTokens_Command,
} from '@libs/nestjs-common';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';

@ApiTags('email-verification')
@Controller('email-verification')
export class VerifyEmailVerification_Controller {
  constructor(
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  @Post('verify')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({
    summary: 'Verify user email address',
    description:
      'Verifies a user email address using the email verification ID and returns tokens for auto-login',
  })
  @ApiBody({
    description: 'Email verification ID',
    type: VerifyEmailRequestDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email successfully verified with auto-login tokens',
    type: VerifyEmail_ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid or expired email verification',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  async verifyEmail(@Body() body: VerifyEmailRequestDto): Promise<VerifyEmail_ResponseDto> {
    // First, get the email verification to find the user ID
    const emailVerification = await this.emailVerificationRepository.findById(
      new Id(body.emailVerificationId),
    );

    if (!emailVerification) {
      throw new NotFoundException('email verification');
    }

    // Execute the verify command
    const command = new VerifyEmail_Command({
      emailVerificationId: body.emailVerificationId,
    });
    await this.commandBus.execute(command);

    // Get user and generate tokens for auto-login
    const user = await this.userRepository.findById(emailVerification.userId);
    if (!user) {
      throw new NotFoundException('user');
    }

    const payload: TokenPayload = {
      userId: user.id.toValue(),
      email: user.email.toValue(),
      role: user.role.toValue(),
    };

    const accessToken = this.jwtTokenService.generateAccessToken(payload);
    const refreshToken = this.jwtTokenService.generateRefreshToken(payload);
    const userId = user.id.toValue();

    // Store tokens (like login does)
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    return {
      userId,
      accessToken,
      refreshToken,
    };
  }
}
