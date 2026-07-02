import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExecutePasswordReset_Command } from '@bc/auth/application/commands/execute-password-reset/execute-password-reset.command';
import { ExecutePasswordReset_ControllerParams } from './execute-password-reset.params';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS, StrictRateLimit } from '@libs/nestjs-common';

@ApiTags('password-reset')
@Controller('password-reset')
export class ExecutePasswordReset_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('execute')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Password reset token not found or user not found',
  })
  async executePasswordReset(@Body() body: ExecutePasswordReset_ControllerParams) {
    const command = new ExecutePasswordReset_Command(body.passwordResetId, body.newPassword);

    await this.commandBus.execute(command);
  }
}
