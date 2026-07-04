import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, EventTrackerService, ReadinessService } from '@libs/nestjs-common';

/**
 * Browser-facing, JWT-protected read endpoints that power the dev-console
 * dashboard. The underlying /event-tracker/stats, /health and /metrics routes
 * are gated behind the internal API key (for Prometheus / service-to-service),
 * so the UI reads the same data through these authenticated endpoints instead.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class DashboardController {
  constructor(
    private readonly eventTracker: EventTrackerService,
    private readonly readiness: ReadinessService,
  ) {}

  @Get('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Integration/domain event throughput statistics' })
  getEvents() {
    return this.eventTracker.getStats();
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Service readiness + subsystem checks' })
  getHealth() {
    return {
      ready: this.readiness.isReady(),
      checks: this.readiness.status(),
      service: process.env.SERVICE_NAME ?? 'service-1',
      environment: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
