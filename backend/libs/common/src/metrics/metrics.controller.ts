import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { InternalApiKeyGuard, Public } from '../auth';
import { MetricsService } from './metrics.service';

// Prometheus scrape endpoint: authenticated by the internal API key (for
// service-to-service / Prometheus), not a user JWT, so exempt from the global
// JwtAuthGuard.
@Public()
@Controller()
@UseGuards(InternalApiKeyGuard)
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    const data = await this.metrics.getMetrics();
    res.set('Content-Type', this.metrics.contentType);
    res.send(data);
  }
}
