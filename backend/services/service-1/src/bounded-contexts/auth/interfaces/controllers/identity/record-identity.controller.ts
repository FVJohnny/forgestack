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
    @Req() req: AuthenticatedRequest,
    @Body() body: RecordIdentity_ControllerParams,
  ): Promise<void> {
    // Extract IP from request headers (handles proxies)
    const ip = this.extractIp(req);
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

  private extractIp(request: AuthenticatedRequest): string {
    // Check for forwarded IP (when behind proxy/load balancer)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one (client IP)
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    // Check for real IP header (nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to socket remote address
    return (
      (request as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
      'unknown'
    );
  }
}
