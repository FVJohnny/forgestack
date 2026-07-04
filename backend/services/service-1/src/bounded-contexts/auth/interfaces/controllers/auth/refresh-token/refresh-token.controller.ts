import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { type IQueryBus } from '@nestjs/cqrs';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  QUERY_BUS,
  COMMAND_BUS,
  StandardRateLimit,
  PublicApi,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetNewTokensFromRefreshToken_Query } from '@bc/auth/application/queries';
import { RefreshToken_ControllerParams } from './refresh-token.params';
import { RefreshToken_ResponseDto } from './refresh-token.controller-response';
import { UnauthorizedException } from '@libs/nestjs-common';
import { StoreTokens_Command, RevokeToken_Command } from '@libs/nestjs-common';

@ApiTags('auth')
@Controller('auth')
export class RefreshToken_Controller {
  constructor(
    @Inject(QUERY_BUS) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
  ) {}

  // Public: authenticated purely by the refresh token itself, NOT by a valid
  // access token. Guarding this with JwtAuthGuard would make refresh
  // impossible once the access token expires, which is the whole point.
  @Post('refresh-token')
  @StandardRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed',
    type: RefreshToken_ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refreshToken(
    @Body() body: RefreshToken_ControllerParams,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshToken_ResponseDto> {
    // Browser clients present the refresh token via the httpOnly cookie;
    // non-browser callers may pass it in the body.
    const presentedRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? body.refreshToken;
    if (!presentedRefreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException();
    }

    let userId: string;
    let accessToken: string;
    let refreshToken: string;
    try {
      const getTokensQuery = new GetNewTokensFromRefreshToken_Query(presentedRefreshToken);
      ({ userId, accessToken, refreshToken } = await this.queryBus.execute(getTokensQuery));
    } catch (error) {
      // Clear stale cookies so the browser stops re-sending a dead token.
      clearAuthCookies(res);
      throw error;
    }

    // Rotate: revoke the presented refresh token so it cannot be reused
    const revokeTokenCommand = new RevokeToken_Command({ token: presentedRefreshToken });
    await this.commandBus.execute(revokeTokenCommand);

    // Store new tokens
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    setAuthCookies(res, { accessToken, refreshToken });

    return { userId };
  }
}
