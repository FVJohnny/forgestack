import { Controller, Get, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { InternalApiKeyGuard } from '../auth';
import { ReadinessService } from './readiness.service';

@Controller()
@SkipThrottle()
export class HeartbeatController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get()
  getRoot(): string {
    return 'ok';
  }

  @Get('health')
  @UseGuards(InternalApiKeyGuard)
  getHealth(): string {
    return 'ok';
  }

  @Get('health/environment')
  @UseGuards(InternalApiKeyGuard)
  getEnvironment(): { environment: string; timestamp: string } {
    const environment = process.env.NODE_ENV ?? 'development';
    return {
      environment,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe: 200 when every registered subsystem is ready, 503 while
   * any subsystem is still initializing (e.g. Kafka consumer joining group).
   * Callers that need post-bootstrap behavior (load balancers, internal
   * waiters) should gate on this instead of the plain `/` heartbeat.
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  getReady(@Res({ passthrough: true }) res: Response): {
    ready: boolean;
    checks: Record<string, boolean>;
  } {
    const checks = this.readinessService.status();
    const ready = this.readinessService.isReady();
    if (!ready) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { ready, checks };
  }
}
