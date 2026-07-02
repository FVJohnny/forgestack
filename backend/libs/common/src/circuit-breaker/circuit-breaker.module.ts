import { DynamicModule, Global, Module, Provider } from '@nestjs/common';

import {
  CIRCUIT_BREAKER_MODULE_OPTIONS,
  type CircuitBreakerModuleOptions,
} from './circuit-breaker.config';
import { CircuitBreakerInterceptor } from './circuit-breaker.interceptor';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Circuit Breaker Module
 * Provides circuit breaker functionality across the application
 */
@Global()
@Module({})
export class CircuitBreakerModule {
  /**
   * Register circuit breaker module with configuration
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     CircuitBreakerModule.register({
   *       defaultConfig: {
   *         timeout: 5000,
   *         errorThresholdPercentage: 50
   *       },
   *       circuits: {
   *         'payment-api': {
   *           timeout: 3000,
   *           errorThresholdPercentage: 30
   *         }
   *       }
   *     })
   *   ]
   * })
   * ```
   */
  static register(options?: CircuitBreakerModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: CIRCUIT_BREAKER_MODULE_OPTIONS,
      useValue: options || {},
    };

    return {
      module: CircuitBreakerModule,
      providers: [optionsProvider, CircuitBreakerService, CircuitBreakerInterceptor],
      exports: [CircuitBreakerService, CircuitBreakerInterceptor],
    };
  }

  /**
   * Register circuit breaker module with default configuration
   * Useful for simple setups without custom configuration
   */
  static forRoot(): DynamicModule {
    return this.register();
  }
}
