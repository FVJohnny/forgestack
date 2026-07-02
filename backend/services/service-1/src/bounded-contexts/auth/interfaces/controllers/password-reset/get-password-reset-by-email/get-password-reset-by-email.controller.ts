import { Controller, Get, Query } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS } from '@libs/nestjs-common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetPasswordResetByEmail_Query } from '@bc/auth/application/queries/get-password-reset-by-email/get-password-reset-by-email.query';
import { GetPasswordResetByEmail_QueryResponse } from '@bc/auth/application/queries/get-password-reset-by-email/get-password-reset-by-email.query-response';

@ApiTags('password-reset')
@Controller('password-reset')
export class GetPasswordResetByEmail_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('')
  @ApiOperation({ summary: 'Get password reset by email' })
  @ApiResponse({
    status: 200,
    description: 'Password reset found',
    type: GetPasswordResetByEmail_QueryResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Password reset not found',
  })
  async getPasswordResetByEmail(
    @Query('email') email: string,
  ): Promise<GetPasswordResetByEmail_QueryResponse> {
    const query = new GetPasswordResetByEmail_Query({ email });
    return await this.queryBus.execute(query);
  }
}
