import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { GlobalExceptionFilter } from './global-exception.filter';

/**
 * Global error handling module
 * Provides standardized error handling across all services
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    GlobalExceptionFilter,
  ],
  exports: [GlobalExceptionFilter],
})
export class ErrorHandlingModule {}
