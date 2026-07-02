import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { type ICommandBus, type IQueryBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  QUERY_BUS,
  StrictRateLimit,
  PublicApi,
  StoreTokens_Command,
} from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecordUserLogin_Command } from '@bc/auth/application/commands';
import { RegisterOrLinkGoogleUser_Command } from '@bc/auth/application/commands/register-or-link-google-user/register-or-link-google-user.command';
import { AuthenticateWithGoogle_Query } from '@bc/auth/application/queries/authenticate-with-google/authenticate-with-google.query';
import { GoogleOAuth_ControllerParams } from './google-oauth.params';
import { GoogleOAuth_ResponseDto } from './google-oauth.controller-response';

@ApiTags('auth')
@Controller('auth')
export class GoogleOAuth_Controller {
  constructor(
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS) private readonly queryBus: IQueryBus,
  ) {}

  @Post('google')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({ summary: 'Authenticate with Google OAuth' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated with Google',
    type: GoogleOAuth_ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid Google token or email not verified',
  })
  async authenticateWithGoogle(@Body() body: GoogleOAuth_ControllerParams) {
    // 1. Register or link Google user (write side)
    const registerCommand = new RegisterOrLinkGoogleUser_Command({
      accessToken: body.accessToken,
    });
    await this.commandBus.execute(registerCommand);

    // 2. Authenticate and get tokens (read side)
    const query = new AuthenticateWithGoogle_Query({ accessToken: body.accessToken });
    const { accessToken, refreshToken, userId } = await this.queryBus.execute(query);

    // 3. Store tokens
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    // 4. Record login (async)
    const recordLoginCommand = new RecordUserLogin_Command({ userId });
    this.commandBus.execute(recordLoginCommand);

    return {
      accessToken,
      refreshToken,
      userId,
    };
  }
}
