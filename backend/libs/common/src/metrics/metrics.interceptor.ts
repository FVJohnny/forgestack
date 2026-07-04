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

    const endTimer = this.metrics.startHttpRequestTimer({ method, route });

    const start = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => {
          const status = res?.statusCode || 200;
          const duration = Number(process.hrtime.bigint() - start) / 1e9;
          endTimer({ status_code: String(status) });
          this.metrics.observeHttpRequest({ method, route, status_code: status }, duration);
        },
        error: () => {
          const status = res?.statusCode || 500;
          const duration = Number(process.hrtime.bigint() - start) / 1e9;
          endTimer({ status_code: String(status) });
          this.metrics.observeHttpRequest({ method, route, status_code: status }, duration);
        },
      }),
    );
  }
}
