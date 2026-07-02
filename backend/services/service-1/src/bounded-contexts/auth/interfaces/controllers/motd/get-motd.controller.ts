import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS } from '@libs/nestjs-common';
import { GetMotd_Query } from '@bc/auth/application/queries/get-motd/get-motd.query';
import type { GetMotd_QueryResponse } from '@bc/auth/application/queries/get-motd/get-motd.query-response';

@ApiTags('motd')
@Controller('motd')
export class GetMotd_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current MOTD (Message of the Day)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current MOTD or null if not set',
  })
  async getMotd(): Promise<GetMotd_QueryResponse | null> {
    const query = new GetMotd_Query();
    return this.queryBus.execute(query);
  }
}
