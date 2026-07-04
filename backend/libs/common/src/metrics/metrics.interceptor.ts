import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const method = (req?.method || 'GET').toUpperCase();
    const route = (req?.route?.path || req?.originalUrl || req?.url || 'unknown').replace(
      /[0-9a-fA-F-]{8,}/g,
      ':id',
    );

    // Measure once and record via observeHttpRequest. The old code ALSO used a
    // startTimer() whose stop callback observes into the same histogram, so
    // every request was counted twice.
    const start = process.hrtime.bigint();
    const record = (fallbackStatus: number) => {
      const status = res?.statusCode || fallbackStatus;
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttpRequest({ method, route, status_code: status }, duration);
    };

    return next.handle().pipe(
      tap({
        next: () => record(200),
        error: () => record(500),
      }),
    );
  }
}
