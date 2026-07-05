import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { RequestContextService } from './request-context.service';
import { TracingService } from './tracing.service';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookies';

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
      // writeHead has several overloads; args is the untyped rest from the
      // monkey-patch, so forward it through the two-arg signature.
      return (originalWriteHead as (...a: unknown[]) => Response).apply(this, args);
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
    // Browsers send the access token in an httpOnly cookie (cookie-parser runs
    // as app-level middleware, before this Nest middleware, so req.cookies is
    // populated); Swagger / service-to-service callers use the bearer header.
    // Read cookie-first or userId enrichment is dead for all browser traffic.
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_TOKEN_COOKIE];
    const authHeader = req.headers.authorization;
    const token =
      cookieToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    if (!token) {
      return undefined;
    }

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
