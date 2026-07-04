import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { type ICommandBus, type IQueryBus } from '@nestjs/cqrs';
import { COMMAND_BUS, QUERY_BUS, StrictRateLimit, PublicApi } from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecordUserLogin_Command } from '@bc/auth/application/commands';
import {
  GetNewTokensFromUserCredentials_Query,
  GetNewTokensFromUserCredentials_QueryResponse,
} from '@bc/auth/application/queries';
import { LoginUser_ControllerParams } from './login-user.params';
import { LoginUser_ResponseDto } from './login-user.controller-response';
import { StoreTokens_Command } from '@libs/nestjs-common';

@ApiTags('auth')
@Controller('auth')
export class LoginUser_Controller {
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
    @Body() body: LoginUser_ControllerParams,
  ): Promise<GetNewTokensFromUserCredentials_QueryResponse> {
    // Get tokens using query
    const tokensQuery = new GetNewTokensFromUserCredentials_Query({
      email: body.email,
      password: body.password,
    });
    const { accessToken, refreshToken, userId } = await this.queryBus.execute(tokensQuery);

    // Store tokens using command (sync)
    const storeTokensCommand = new StoreTokens_Command({ userId, accessToken, refreshToken });
    await this.commandBus.execute(storeTokensCommand);

    // Record login using command (Async)
    const recordLoginCommand = new RecordUserLogin_Command({ userId });
    this.commandBus.execute(recordLoginCommand);

    return {
      accessToken,
      refreshToken,
      userId,
    };
  }
}
