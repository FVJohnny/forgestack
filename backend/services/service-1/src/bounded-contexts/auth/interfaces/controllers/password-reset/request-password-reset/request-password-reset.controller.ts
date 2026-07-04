import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RequestPasswordReset_Command } from '@bc/auth/application/commands/request-password-reset/request-password-reset.command';
import { RequestPasswordReset_ControllerParams } from './request-password-reset.params';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS, StrictRateLimit } from '@libs/nestjs-common';

@ApiTags('password-reset')
@Controller('password-reset')
export class RequestPasswordReset_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('request')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset request successfully processed',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid email format',
  })
  async requestPasswordReset(@Body() body: RequestPasswordReset_ControllerParams) {
    const command = new RequestPasswordReset_Command(body);

    await this.commandBus.execute(command);
  }
}
