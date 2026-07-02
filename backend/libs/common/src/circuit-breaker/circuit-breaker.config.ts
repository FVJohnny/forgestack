import type { Options as OpossumOptions } from 'opossum';

/**
 * Circuit Breaker Configuration Options
 * Wraps opossum options with sensible defaults for microservices
 */
export interface CircuitBreakerConfig extends Partial<OpossumOptions> {
  /**
   * Unique name for the circuit breaker (used for metrics and logging)
   */
  name?: string;

  /**
   * Whether to enable Prometheus metrics collection
   * @default true
   */
  enableMetrics?: boolean;

  /**
   * Whether circuit breaker is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Default Circuit Breaker Configuration
 * Based on microservices best practices
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  /**
   * Timeout after which the promise is rejected (ms)
   */
  timeout: 3000,

  /**
   * Error percentage at which to open the circuit
   */
  errorThresholdPercentage: 50,

  /**
   * Time after which to try resetting the circuit (ms)
   */
  resetTimeout: 30000,

  /**
   * Time window for rolling error counts (ms)
   */
  rollingCountTimeout: 10000,

  /**
   * Number of buckets in the rolling window
   */
  rollingCountBuckets: 10,

  /**
   * Maximum number of concurrent requests
   */
  capacity: 100,

  /**
   * Minimum number of requests before error percentage is calculated
   */
  volumeThreshold: 10,

  /**
   * Enable Prometheus metrics
   */
  enableMetrics: true,

  /**
   * Circuit breaker enabled by default
   */
  enabled: true,
};

/**
 * Module configuration options for CircuitBreakerModule
 */
export interface CircuitBreakerModuleOptions {
  /**
   * Global default configuration for all circuit breakers
   */
  defaultConfig?: CircuitBreakerConfig;

  /**
   * Named circuit breaker configurations
   */
  circuits?: Record<string, CircuitBreakerConfig>;
}

/**
 * Constants for circuit breaker metadata
 */
export const CIRCUIT_BREAKER_METADATA_KEY = Symbol('circuit-breaker:config');
export const CIRCUIT_BREAKER_MODULE_OPTIONS = Symbol('circuit-breaker:module-options');
