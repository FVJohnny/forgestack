import type { HttpStatus } from '@nestjs/common';

/**
 * Base exception class for all application errors
 * Provides structure and metadata for error handling
 */
export abstract class BaseException extends Error {
  public readonly timestamp: Date;
  public path?: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: HttpStatus,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert exception to JSON for logging and API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      timestamp: this.timestamp.toISOString(),
      ...(this.path && { path: this.path }),
    };
  }

  /**
   * Set request path context
   */
  setPath(path: string): void {
    this.path = path;
  }
}
