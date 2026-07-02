import { Controller, Post, Body, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS, PublicApi, StrictRateLimit } from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExecutePasswordReset_Command } from '@bc/auth/application/commands/execute-password-reset/execute-password-reset.command';

export interface ExecutePasswordResetParams {
  passwordResetId: string;
  newPassword: string;
}

@ApiTags('auth')
@Controller('auth')
export class ExecutePasswordReset_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('password-reset/execute')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({ summary: 'Execute password reset with a new password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Password reset ID not found or already used',
  })
  async executePasswordReset(@Body() body: ExecutePasswordResetParams): Promise<void> {
    const command = new ExecutePasswordReset_Command(body.passwordResetId, body.newPassword);
    await this.commandBus.execute(command);
  }
}
