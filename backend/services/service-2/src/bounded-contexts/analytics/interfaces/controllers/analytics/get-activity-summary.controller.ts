import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS } from '@libs/nestjs-common';
import { GetActivitySummary_Query } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query';
import type { GetActivitySummary_QueryResponse } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query-response';

@ApiTags('analytics')
@Controller('analytics')
export class GetActivitySummary_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aggregated user-activity counts built from integration events' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Totals per event type and the time of the last activity',
  })
  async getSummary(): Promise<GetActivitySummary_QueryResponse> {
    const query = new GetActivitySummary_Query();
    return this.queryBus.execute(query);
  }
}
