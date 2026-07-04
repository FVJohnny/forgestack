import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { RequestContextService } from './request-context.service';
import { TracingService } from './tracing.service';

/**
 * Middleware that:
 * 1. Wraps request in AsyncLocalStorage for request-scoped context (userId)
 * 2. Extracts userId from JWT token (if present) without validation
 * 3. Adds trace context to response headers
 *
 * OpenTelemetry auto-instrumentation handles trace propagation
 */
@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract userId from JWT token if present (decode without verification)
    const userId = this.extractUserIdFromToken(req);

    // Intercept writeHead to set trace ID header before response is sent
    const originalWriteHead = res.writeHead;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.writeHead = function (this: Response, ...args: any[]) {
      const traceMetadata = TracingService.getTraceMetadata();
      if (traceMetadata && !res.headersSent) {
        res.setHeader('x-trace-id', traceMetadata.traceId);
        res.setHeader('x-span-id', traceMetadata.spanId);
      }
      return originalWriteHead.apply(this, args);
    };

    // Wrap the request in AsyncLocalStorage context
    RequestContextService.run({ userId }, () => {
      next();
    });
  }

  /**
   * Extract userId from JWT token without verification.
   * This allows logging the userId even for requests that may fail auth.
   */
  private extractUserIdFromToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.slice(7);
    try {
      // Decode JWT payload without verification (just base64 decode)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return undefined;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return payload.userId;
    } catch {
      return undefined;
    }
  }
}
