import { Controller, Get, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS } from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  GetEmailVerificationByUserId_Query,
  GetEmailVerificationByUserId_QueryResponse,
} from '@bc/auth/application/queries';

@ApiTags('email-verification')
@Controller('email-verification')
export class GetEmailVerificationByUserId_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('')
  @ApiOperation({ summary: 'Get email verification by user ID or email' })
  @ApiResponse({
    status: 200,
    description: 'Email verification found',
    type: GetEmailVerificationByUserId_QueryResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Email verification not found',
  })
  async getEmailVerificationByUserId(
    @Query('userId') userId?: string,
    @Query('email') email?: string,
  ): Promise<GetEmailVerificationByUserId_QueryResponse> {
    const query = new GetEmailVerificationByUserId_Query({ userId, email });
    return await this.queryBus.execute(query);
  }
}
