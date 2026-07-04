import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  Req,
  Res,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { type IQueryBus } from '@nestjs/cqrs';
import {
  JwtAuthGuard,
  AdminRoleGuard,
  QUERY_BUS,
  StrictRateLimit,
  type AuthenticatedRequest,
  setAuthCookies,
  stashAdminCookies,
} from '@libs/nestjs-common';
import { ImpersonateUser_Query } from '@bc/auth/application/queries/impersonate-user/impersonate-user.query';

class ImpersonateUser_ResponseDto {
  userId: string;
  impersonatedEmail: string;
}

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class ImpersonateUser_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Post('impersonate/:userId')
  @StrictRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Impersonate a user (admin only)' })
  @ApiParam({ name: 'userId', description: 'ID of the user to impersonate' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Impersonation tokens generated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required or cannot impersonate admin users',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async impersonateUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest & Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ImpersonateUser_ResponseDto> {
    const query = new ImpersonateUser_Query({
      adminUserId: req.tokenData.userId,
      adminEmail: req.tokenData.email,
      targetUserId: userId,
    } as ImpersonateUser_Query);

    const {
      accessToken,
      refreshToken,
      userId: impersonatedUserId,
      impersonatedEmail,
    } = await this.queryBus.execute(query);

    // Stash the admin's current cookies so "stop impersonating" can restore
    // them, then set the impersonation tokens as the active cookies.
    stashAdminCookies(req, res);
    setAuthCookies(res, { accessToken, refreshToken });

    return { userId: impersonatedUserId, impersonatedEmail };
  }
}
