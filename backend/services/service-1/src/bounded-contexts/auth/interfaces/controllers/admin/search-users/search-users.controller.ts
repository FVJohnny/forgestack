import { Controller, Get, HttpCode, HttpStatus, UseGuards, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard, AdminRoleGuard, QUERY_BUS, RelaxedRateLimit } from '@libs/nestjs-common';
import { SearchUsers_Query } from '@bc/auth/application/queries/search-users/search-users.query';
import type { SearchUsers_QueryResponse } from '@bc/auth/application/queries/search-users/search-users.query-response';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class SearchUsers_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('users/search')
  @RelaxedRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search users by email (admin only)' })
  @ApiQuery({ name: 'email', required: true, description: 'Email pattern to search for' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 10)',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users matching the search criteria',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async searchUsers(
    @Query('email') email: string,
    @Query('limit') limit?: string,
  ): Promise<SearchUsers_QueryResponse> {
    const query = new SearchUsers_Query({
      email,
      limit: limit ? parseInt(limit, 10) : 10,
    } as SearchUsers_Query);

    return this.queryBus.execute(query);
  }
}
