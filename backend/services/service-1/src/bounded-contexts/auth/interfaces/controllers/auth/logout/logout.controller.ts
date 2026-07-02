import { Controller, Post, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Logout_Command } from '@bc/auth/application/commands/logout/logout.command';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  JwtAuthGuard,
  type AuthenticatedRequest,
  StrictRateLimit,
} from '@libs/nestjs-common';

@ApiTags('auth')
@Controller('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class Logout_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('logout')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke current token' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Successfully logged out',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async logout(@Req() req: AuthenticatedRequest) {
    const command = new Logout_Command(req.tokenData.userId);
    await this.commandBus.execute(command);
  }
}
