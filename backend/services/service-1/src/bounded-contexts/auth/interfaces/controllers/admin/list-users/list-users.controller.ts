import { Controller, Get, HttpCode, HttpStatus, UseGuards, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard, AdminRoleGuard, QUERY_BUS, RelaxedRateLimit } from '@libs/nestjs-common';
import {
  ListUsers_Query,
  type ListUsers_FilterField,
} from '@bc/auth/application/queries/list-users/list-users.query';
import type { ListUsers_QueryResponse } from '@bc/auth/application/queries/list-users/list-users.query-response';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class ListUsers_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('users')
  @RelaxedRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List users with pagination and filtering (admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)', type: Number })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default 10)',
    type: Number,
  })
  @ApiQuery({
    name: 'filterField',
    required: false,
    description: 'Field to filter by: email, ip (default: email)',
    type: String,
  })
  @ApiQuery({
    name: 'filterValue',
    required: false,
    description: 'Value to filter by (contains search)',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of users',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filterField') filterField?: string,
    @Query('filterValue') filterValue?: string,
  ): Promise<ListUsers_QueryResponse> {
    const query = new ListUsers_Query({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      filterValue: filterValue || undefined,
      filterField: filterField as ListUsers_FilterField,
    });

    return this.queryBus.execute(query);
  }
}
