import { Controller, Post, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  JwtAuthGuard,
  StrictRateLimit,
  UnauthorizedException,
  restoreAdminCookies,
  JwtTokenService,
} from '@libs/nestjs-common';

class StopImpersonation_ResponseDto {
  userId: string;
}

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
// Only JwtAuthGuard: during impersonation the active token is the impersonated
// (non-admin) user's, so AdminRoleGuard would reject. Authorization instead
// comes from possessing the stashed admin_* cookies, which only an active
// impersonation session has.
@UseGuards(JwtAuthGuard)
export class StopImpersonation_Controller {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  @Post('stop-impersonation')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop impersonating and restore the admin session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Admin session restored' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'No active impersonation' })
  async stopImpersonation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StopImpersonation_ResponseDto> {
    const restored = restoreAdminCookies(req, res);
    if (!restored) {
      throw new UnauthorizedException();
    }

    // Derive the admin user id from the restored access token so the frontend
    // can update its in-memory state without an extra round trip.
    const { userId } = this.jwtTokenService.verifyAccessToken(restored.accessToken);
    return { userId };
  }
}
