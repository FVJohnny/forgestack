import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { type ICommandBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { COMMAND_BUS, JwtAuthGuard, type AuthenticatedRequest } from '@libs/nestjs-common';
import { RecordIdentity_Command } from '@bc/auth/application/commands/record-identity/record-identity.command';
import { RecordIdentity_ControllerParams } from './record-identity.params';

@ApiTags('identity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('identity')
export class RecordIdentity_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post('record')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record user identity markers (IP, fingerprint, etc.)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Identity recorded successfully',
  })
  async recordIdentity(
    @Req() req: Request & AuthenticatedRequest,
    @Body() body: RecordIdentity_ControllerParams,
  ): Promise<void> {
    // req.ip honors the app-level 'trust proxy' setting (see configureApp),
    // so clients cannot spoof it with their own X-Forwarded-For header.
    const ip = req.ip ?? 'unknown';
    const userAgent = req.headers['user-agent'];

    const command = new RecordIdentity_Command(
      req.tokenData.userId,
      ip,
      userAgent,
      body.fingerprint,
      body.deviceId,
    );

    await this.commandBus.execute(command);
  }
}
