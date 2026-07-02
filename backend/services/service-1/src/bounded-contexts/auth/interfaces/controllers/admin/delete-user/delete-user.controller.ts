import {
  Controller,
  Delete,
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
import { DeleteUser_Command } from '@bc/auth/application/commands/delete-user/delete-user.command';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class DeleteUser_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Delete('users/:userId')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiParam({ name: 'userId', description: 'ID of the user to delete' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required or cannot delete yourself/other admins',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async deleteUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new DeleteUser_Command({
      userIdToDelete: userId,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
