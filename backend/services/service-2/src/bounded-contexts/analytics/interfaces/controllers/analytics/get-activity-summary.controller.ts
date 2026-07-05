import { Controller, Get, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import { QUERY_BUS, InternalApiKeyGuard, JwtAuthGuard, Public } from '@libs/nestjs-common';
import { GetActivitySummary_Query } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query';
import type { GetActivitySummary_QueryResponse } from '@bc/analytics/application/queries/get-activity-summary/get-activity-summary.query-response';

// service-2 has no user auth of its own, but its .env carries the same JWT
// secrets as service-1, so service-1's user tokens validate here. Do NOT put
// @Public() at the class level: it would exempt the JWT route below from
// authentication too (the guard reads the class-level flag and skips).
@ApiTags('analytics')
@Controller('analytics')
export class GetActivitySummary_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  // Operational endpoint for service-to-service and Prometheus. Guarded by the
  // internal API key (the same guard the health/metrics endpoints use), so it is
  // not world-readable and not reachable from a browser session. Marked @Public
  // so any global JWT guard skips it; the internal-key guard does the check.
  @Public()
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

  // Browser-facing twin of the endpoint above. The dev-console dashboard sends
  // the user's access-token cookie (not the internal key), so it reads the same
  // data through this JWT-protected route. This mirrors service-1's
  // DashboardController, which re-exposes its internal-key routes for the UI.
  @Get('dashboard/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Browser-facing user-activity counts (JWT-protected)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Totals per event type and the time of the last activity',
  })
  async getDashboardSummary(): Promise<GetActivitySummary_QueryResponse> {
    const query = new GetActivitySummary_Query();
    return this.queryBus.execute(query);
  }
}
