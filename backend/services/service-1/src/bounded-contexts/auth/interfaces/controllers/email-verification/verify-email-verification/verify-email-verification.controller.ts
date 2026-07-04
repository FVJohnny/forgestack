import { Controller, Post, Body, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type ICommandBus, type IQueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  COMMAND_BUS,
  QUERY_BUS,
  PublicApi,
  StrictRateLimit,
  StoreTokens_Command,
  setAuthCookies,
} from '@libs/nestjs-common';
import { VerifyEmail_Command } from '@bc/auth/application/commands';
import { GetNewTokensFromEmailVerification_Query } from '@bc/auth/application/queries';
import { VerifyEmailRequestDto } from './verify-email-verification.params';
import { VerifyEmail_ResponseDto } from './verify-email-verification.controller-response';

@ApiTags('email-verification')
@Controller('email-verification')
export class VerifyEmailVerification_Controller {
  constructor(
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS) private readonly queryBus: IQueryBus,
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
  async verifyEmail(
    @Body() body: VerifyEmailRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyEmail_ResponseDto> {
    // Verify the email (404s if the verification doesn't exist)
    const command = new VerifyEmail_Command({
      emailVerificationId: body.emailVerificationId,
    });
    await this.commandBus.execute(command);

    // Get tokens for auto-login using query
    const tokensQuery = new GetNewTokensFromEmailVerification_Query({
      emailVerificationId: body.emailVerificationId,
    });
    const { userId, accessToken, refreshToken } = await this.queryBus.execute(tokensQuery);

    // Store tokens using command (like login does)
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    // Deliver tokens as httpOnly cookies for auto-login; body carries userId.
    setAuthCookies(res, { accessToken, refreshToken });

    return { userId };
  }
}
