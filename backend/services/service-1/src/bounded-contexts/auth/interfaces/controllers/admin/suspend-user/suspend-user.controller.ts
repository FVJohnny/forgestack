import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  Req,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  JwtAuthGuard,
  AdminRoleGuard,
  COMMAND_BUS,
  StrictRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { SuspendUser_Command } from '@bc/auth/application/commands/suspend-user/suspend-user.command';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class SuspendUser_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('users/:userId/suspend')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suspend a user (admin only)' })
  @ApiParam({ name: 'userId', description: 'ID of the user to suspend' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User suspended successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async suspendUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new SuspendUser_Command({
      userIdToSuspend: userId,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
