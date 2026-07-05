import { Controller, Get, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS, InternalApiKeyGuard, Public } from '@libs/nestjs-common';
import { GetActivitySummary_Query } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query';
import type { GetActivitySummary_QueryResponse } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query-response';

// Authenticated by the internal API key, not a user JWT (service-2 has no user
// auth), so exempt from the global JwtAuthGuard.
@Public()
@ApiTags('analytics')
@Controller('analytics')
export class GetActivitySummary_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  // This endpoint returns aggregate signup/activity metrics, which should not be
  // world-readable. Guard it behind the internal API key (the same guard the
  // health/metrics endpoints use). A real product would likely put this behind
  // JWT + an admin role instead; the internal-key guard is the closest match to
  // the other operational endpoints in this template.
  @Get('summary')
  @UseGuards(InternalApiKeyGuard)
  @ApiSecurity('ApiKey')
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
