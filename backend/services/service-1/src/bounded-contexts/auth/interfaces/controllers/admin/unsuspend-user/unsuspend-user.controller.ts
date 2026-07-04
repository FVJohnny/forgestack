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
import { UnsuspendUser_Command } from '@bc/auth/application/commands/unsuspend-user/unsuspend-user.command';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class UnsuspendUser_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('users/:userId/unsuspend')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsuspend a user (admin only)' })
  @ApiParam({ name: 'userId', description: 'ID of the user to unsuspend' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User unsuspended successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async unsuspendUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new UnsuspendUser_Command({
      userIdToUnsuspend: userId,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
