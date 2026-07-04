import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
  COMMAND_BUS,
  StrictRateLimit,
} from '@libs/nestjs-common';
import { ChangePassword_Command } from '@bc/auth/application/commands/change-password/change-password.command';

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

@ApiTags('auth')
@Controller('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ChangePassword_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('change-password')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully changed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid current password',
  })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordParams,
  ): Promise<void> {
    const command = new ChangePassword_Command(
      req.tokenData.userId,
      body.oldPassword,
      body.newPassword,
    );
    await this.commandBus.execute(command);
  }
}
