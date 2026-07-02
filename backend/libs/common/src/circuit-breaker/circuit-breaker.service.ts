/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import CircuitBreaker, { type Stats } from 'opossum';

import { CorrelationLogger } from '../logger/correlation-logger';
import {
  CIRCUIT_BREAKER_MODULE_OPTIONS,
  type CircuitBreakerConfig,
  type CircuitBreakerModuleOptions,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker.config';

/**
 * Circuit Breaker Service
 * Manages circuit breakers for protecting service calls
 */
@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new CorrelationLogger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    @Optional()
    @Inject(CIRCUIT_BREAKER_MODULE_OPTIONS)
    private readonly moduleOptions?: CircuitBreakerModuleOptions,
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    config?: CircuitBreakerConfig,
    ...args: any[]
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(name, fn, config);

    if (!breaker) {
      // Circuit breaker disabled, execute directly
      return fn(...args);
    }

    try {
      return (await breaker.fire(...args)) as T;
    } catch (error) {
      this.logger.error(
        `Circuit breaker "${name}" call failed`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get or create a circuit breaker instance
   */
  private getOrCreateBreaker<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    config?: CircuitBreakerConfig,
  ): CircuitBreaker | null {
    const finalConfig = this.mergeConfig(name, config);

    // If disabled, return null to bypass circuit breaker
    if (finalConfig.enabled === false) {
      return null;
    }

    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const breaker = new CircuitBreaker(fn, finalConfig);
    this.setupEventListeners(name, breaker);
    this.breakers.set(name, breaker);

    this.logger.log(
      `Circuit breaker "${name}" created with config: ${JSON.stringify(finalConfig)}`,
    );

    return breaker;
  }

  /**
   * Merge configuration from multiple sources
   * Priority: method config > named config > default config > hardcoded defaults
   */
  private mergeConfig(name: string, config?: CircuitBreakerConfig): CircuitBreakerConfig {
    const namedConfig = this.moduleOptions?.circuits?.[name];
    const defaultConfig = this.moduleOptions?.defaultConfig;

    return {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...defaultConfig,
      ...namedConfig,
      ...config,
      name,
    };
  }

  /**
   * Setup event listeners for circuit breaker monitoring
   */
  private setupEventListeners(name: string, breaker: CircuitBreaker): void {
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker "${name}" opened - requests will be blocked`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker "${name}" half-open - testing if service recovered`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker "${name}" closed - normal operation resumed`);
    });

    breaker.on('timeout', () => {
      this.logger.warn(`Circuit breaker "${name}" timeout occurred`);
    });

    breaker.on('reject', () => {
      this.logger.debug(`Circuit breaker "${name}" rejected request`);
    });

    breaker.on('fallback', (result: any) => {
      this.logger.debug(`Circuit breaker "${name}" fallback executed with result: ${result}`);
    });

    breaker.on('success', () => {
      this.logger.debug(`Circuit breaker "${name}" successful call`);
    });

    breaker.on('failure', (error: Error) => {
      this.logger.error(`Circuit breaker "${name}" failure`, error);
    });
  }

  /**
   * Get circuit breaker by name
   */
  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breaker names
   */
  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(name: string): Stats | undefined {
    const breaker = this.breakers.get(name);
    return breaker?.stats;
  }

  /**
   * Get all circuit breakers statistics
   */
  getAllStats(): Record<string, Stats> {
    const stats: Record<string, Stats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.stats;
    });
    return stats;
  }

  /**
   * Manually open a circuit breaker
   */
  open(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.open();
      this.logger.log(`Circuit breaker "${name}" manually opened`);
    }
  }

  /**
   * Manually close a circuit breaker
   */
  close(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      this.logger.log(`Circuit breaker "${name}" manually closed`);
    }
  }

  /**
   * Clear all circuit breakers on module destroy
   */
  onModuleDestroy(): void {
    this.logger.log('Shutting down all circuit breakers');
    this.breakers.forEach((breaker, name) => {
      breaker.shutdown();
      this.logger.debug(`Circuit breaker "${name}" shut down`);
    });
    this.breakers.clear();
  }
}
