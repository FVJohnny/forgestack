import {
  Controller,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Body,
  Req,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  JwtAuthGuard,
  AdminRoleGuard,
  COMMAND_BUS,
  StrictRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { SetMotd_Command } from '@bc/auth/application/commands/set-motd/set-motd.command';
import { DeleteMotd_Command } from '@bc/auth/application/commands/delete-motd/delete-motd.command';

class SetMotdDto {
  @ApiProperty({ description: 'MOTD content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class Motd_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Put('motd')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set or update MOTD (admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'MOTD set successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async setMotd(@Body() dto: SetMotdDto, @Req() req: AuthenticatedRequest): Promise<void> {
    const command = new SetMotd_Command({
      content: dto.content,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }

  @Delete('motd')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MOTD (admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'MOTD deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async deleteMotd(@Req() req: AuthenticatedRequest): Promise<void> {
    const command = new DeleteMotd_Command({
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
