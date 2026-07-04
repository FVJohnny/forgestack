/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, Observable } from 'rxjs';

import { CIRCUIT_BREAKER_METADATA_KEY, type CircuitBreakerConfig } from './circuit-breaker.config';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Circuit Breaker Interceptor
 * Automatically wraps method calls with circuit breaker protection
 *
 * Usage:
 * 1. Apply @CircuitBreaker() decorator to methods
 * 2. Apply @UseInterceptors(CircuitBreakerInterceptor) to class or controller
 *
 * @example
 * ```typescript
 * @Injectable()
 * @UseInterceptors(CircuitBreakerInterceptor)
 * class PaymentService {
 *   @CircuitBreaker({ name: 'payment-api', timeout: 3000 })
 *   async processPayment(data: PaymentDTO) {
 *     // External API call
 *   }
 * }
 * ```
 */
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const target = context.getClass();

    // Check if method has @CircuitBreaker decorator
    const config = this.reflector.get<CircuitBreakerConfig>(CIRCUIT_BREAKER_METADATA_KEY, handler);

    // If no circuit breaker config, proceed normally
    if (!config) {
      return next.handle();
    }

    // Get circuit name from metadata or generate one
    const circuitName =
      config.name ||
      Reflect.getMetadata('circuit-breaker:name', target.prototype, handler.name) ||
      `${target.name}.${handler.name}`;

    // Wrap the handler execution with circuit breaker
    const wrappedExecution = async () => {
      // Get the result from the original handler
      const result = await next.handle().toPromise();
      return result;
    };

    // Execute with circuit breaker protection
    return from(this.circuitBreakerService.execute(circuitName, wrappedExecution, config));
  }
}
