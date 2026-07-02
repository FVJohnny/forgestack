import { Controller, Post, Body, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS, PublicApi, StrictRateLimit } from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RequestPasswordReset_Command } from '@bc/auth/application/commands/request-password-reset/request-password-reset.command';

export interface RequestPasswordResetParams {
  email: string;
}

@ApiTags('auth')
@Controller('auth')
export class RequestPasswordReset_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('password-reset')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @PublicApi()
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent (if user exists)',
  })
  async requestPasswordReset(@Body() body: RequestPasswordResetParams): Promise<void> {
    const command = new RequestPasswordReset_Command({ email: body.email });
    await this.commandBus.execute(command);
  }
}
