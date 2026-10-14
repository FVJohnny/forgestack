import { Controller, Get, HttpCode, HttpStatus, UseGuards, Req, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import {
  JwtAuthGuard,
  QUERY_BUS,
  RelaxedRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { GetSigninActivity_Query } from '@bc/auth/application/queries/get-signin-activity/get-signin-activity.query';
import type { GetSigninActivity_QueryResponse } from '@bc/auth/application/queries/get-signin-activity/get-signin-activity.query-response';

@ApiTags('auth')
@Controller('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GetMyActivity_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('me/activity')
  @RelaxedRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "The signed-in user's recent sign-in activity" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Last login time plus the known IPs and user agents',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired token',
  })
  async getMyActivity(@Req() req: AuthenticatedRequest): Promise<GetSigninActivity_QueryResponse> {
    const query = new GetSigninActivity_Query({ userId: req.tokenData.userId });
    return this.queryBus.execute(query);
  }
}
