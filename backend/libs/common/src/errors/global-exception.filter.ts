import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { CorrelationLogger } from '../logger';
import { Request, Response } from 'express';

import { BaseException } from './base.exception';
/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    cause?: string;
    timestamp: string;
    path: string;
    stack?: string;
    retryAfterSeconds?: number;
  };
}

/**
 * Global exception filter that standardizes all error responses
 * Handles both custom exceptions and unexpected errors
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new CorrelationLogger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request.url;
    const timestamp = new Date().toISOString();

    let errorResponse: ErrorResponse;

    if (exception instanceof BaseException) {
      errorResponse = this.handleBaseException(exception, path, timestamp);
      this.logException(exception, false);
    } else if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception, path, timestamp);
      this.logException(exception, false);
    } else {
      errorResponse = this.handleUnexpectedException(exception, path, timestamp);
      this.logException(exception, true);
    }

    response.set('Content-Type', 'application/problem+json');
    response.status(this.getHttpStatus(exception)).json(errorResponse);
  }

  private handleBaseException(
    exception: BaseException,
    path: string,
    timestamp: string,
  ): ErrorResponse {
    if (!exception.path) {
      exception.setPath(path);
    }

    // Check for retryAfterSeconds (e.g., a rate-limit exception)
    const retryAfterSeconds =
      'retryAfterSeconds' in exception
        ? (exception as BaseException & { retryAfterSeconds: number }).retryAfterSeconds
        : undefined;

    return {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        cause: exception.cause?.message,
        timestamp,
        path,
        ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      },
    };
  }

  private handleHttpException(
    exception: HttpException,
    path: string,
    timestamp: string,
  ): ErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse() as string | { message: string };

    // Extract message from NestJS exception response
    const message =
      typeof response === 'string' ? response : response?.message || exception.message;

    return {
      success: false,
      error: {
        code: `HTTP_${status}`,
        message: Array.isArray(message) ? message.join(', ') : message,
        timestamp,
        path,
      },
    };
  }

  private handleUnexpectedException(
    exception: unknown,
    path: string,
    timestamp: string,
  ): ErrorResponse {
    const error = exception instanceof Error ? exception : new Error('Unknown error');

    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: this.isProduction() ? 'An unexpected error occurred' : error.message,
        timestamp,
        path,
      },
    };
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof BaseException) {
      return exception.httpStatus;
    }
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private logException(exception: unknown, isUnexpected = false): void {
    const error = exception instanceof Error ? exception : new Error('Unknown error');
    const logLevel = isUnexpected ? 'error' : 'warn';

    // Build a readable log message
    const logParts = [`${error.name}: ${error.message}`];
    if (exception instanceof BaseException) {
      logParts.push(`[code: ${exception.code}]`);
      logParts.push(`[httpStatus: ${exception.httpStatus}]`);
      logParts.push(`[stack: ${exception.stack}]`);
      logParts.push(`[cause: ${exception.cause?.name}: ${exception.cause?.message}]`);
      logParts.push(`[causeStack: ${exception.cause?.stack}]`);
    }

    const logMessage = logParts.join('\n');

    // Log with readable format
    this.logger[logLevel](logMessage);
  }

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
