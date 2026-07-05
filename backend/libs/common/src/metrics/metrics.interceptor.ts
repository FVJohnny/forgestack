import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

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

    // Record on response 'finish', which fires AFTER the exception filter has
    // set the final status code. Reading res.statusCode inside a tap() instead
    // is wrong: interceptors run before the filter, so on a thrown error the
    // status is still Express's default 200 and every 4xx/5xx was recorded as
    // 200 (blinding error-rate dashboards and the 5xx alert). 'finish' fires
    // exactly once per response, on both the success and error paths.
    const start = process.hrtime.bigint();
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      const status = res?.statusCode || 200;
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttpRequest({ method, route, status_code: status }, duration);
    };
    res?.on('finish', record);
    res?.on('close', record); // client aborted before finish

    return next.handle();
  }
}
