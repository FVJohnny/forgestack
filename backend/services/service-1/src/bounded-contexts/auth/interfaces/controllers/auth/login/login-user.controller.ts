import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { type ICommandBus, type IQueryBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  QUERY_BUS,
  StrictRateLimit,
  PublicApi,
  setAuthCookies,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecordIdentity_Command, RecordUserLogin_Command } from '@bc/auth/application/commands';
import { GetNewTokensFromUserCredentials_Query } from '@bc/auth/application/queries';
import { LoginUser_ControllerParams } from './login-user.params';
import { LoginUser_ResponseDto } from './login-user.controller-response';
import { StoreTokens_Command } from '@libs/nestjs-common';

@ApiTags('auth')
@Controller('auth')
export class LoginUser_Controller {
  private readonly logger = new CorrelationLogger(LoginUser_Controller.name);

  constructor(
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS) private readonly queryBus: IQueryBus,
  ) {}

  @Post('login')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged in',
    type: LoginUser_ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async loginUser(
    @Req() req: Request,
    @Body() body: LoginUser_ControllerParams,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginUser_ResponseDto> {
    // Get tokens using query
    const tokensQuery = new GetNewTokensFromUserCredentials_Query({
      email: body.email,
      password: body.password,
    });
    const { accessToken, refreshToken, userId } = await this.queryBus.execute(tokensQuery);

    // Store tokens using command (sync)
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    // Record login without blocking the response (last-login tracking is not
    // critical), but attach a catch so a failure is logged instead of becoming
    // an unhandled promise rejection.
    const recordLoginCommand = new RecordUserLogin_Command({ userId });
    void this.commandBus.execute(recordLoginCommand).catch((error) => {
      this.logger.error(`Failed to record login for user ${userId}`, error as Error);
    });

    // Record the login IP and User-Agent on the user (fire-and-forget, like
    // last-login tracking). req.ip honors the app-level 'trust proxy' setting
    // (see configureApp), so clients cannot spoof it with X-Forwarded-For.
    const recordIdentityCommand = new RecordIdentity_Command(
      userId,
      req.ip ?? 'unknown',
      req.headers['user-agent'],
    );
    void this.commandBus.execute(recordIdentityCommand).catch((error) => {
      this.logger.error(`Failed to record identity for user ${userId}`, error as Error);
    });

    // Deliver tokens as httpOnly cookies; the body carries only the user id.
    setAuthCookies(res, { accessToken, refreshToken });

    return { userId };
  }
}
