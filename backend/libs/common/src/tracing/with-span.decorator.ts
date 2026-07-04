import { TracingService } from './tracing.service';

/**
 * Options for configuring the @WithSpan decorator
 */
export interface WithSpanOptions {
  /**
   * Extract specific properties from method arguments to include as span attributes
   * Supports dot notation for nested properties (e.g., 'user.id', 'query.filters')
   * @example ['constructor.name', 'userId', 'aggregateId']
   */
  attributesFrom?: string[];

  /**
   * Static attributes to always include in the span
   * @example { 'component': 'query-handler', 'layer': 'application' }
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * Prefix for the span name. If provided, will be used as: `${prefix}.${spanName}`
   * @example 'query.execute' -> final span name will be 'query.execute.GetUserQuery'
   */
  prefix?: string;

  /**
   * Index of the argument to use for extracting the span name (default: 0)
   * The argument's constructor.name will be used
   */
  nameFromArgIndex?: number;
}

/**
 * Decorator that automatically creates a span for the decorated method
 *
 * @param spanNameOrPrefix - Either a static span name, or a prefix if using dynamic naming
 * @param options - Configuration options for attribute extraction and span naming
 *
 * @example
 * // Simple usage with static name
 * @WithSpan('user.service.createUser')
 * async createUser(data: CreateUserDto) { ... }
 *
 * @example
 * // Dynamic name from argument's constructor
 * @WithSpan('query.execute', { attributesFrom: ['constructor.name', 'userId'] })
 * async execute(query: GetUserQuery): Promise<User> { ... }
 * // Creates span: 'query.execute.GetUserQuery' with attribute 'userId'
 *
 * @example
 * // With static attributes
 * @WithSpan('command.execute', {
 *   attributesFrom: ['constructor.name', 'aggregateId'],
 *   attributes: { 'component': 'command-handler' }
 * })
 * async execute(command: RegisterUserCommand) { ... }
 */
export function WithSpan(spanNameOrPrefix: string, options: WithSpanOptions = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const nameFromArgIndex = options.nameFromArgIndex ?? 0;
      const firstArg = args[nameFromArgIndex];

      // Build span name
      let spanName = spanNameOrPrefix;
      if (options.prefix || options.attributesFrom?.includes('constructor.name')) {
        const argConstructorName =
          firstArg && typeof firstArg === 'object' && 'constructor' in firstArg
            ? (firstArg.constructor as { name?: string }).name
            : undefined;

        if (argConstructorName) {
          spanName = options.prefix
            ? `${options.prefix}.${argConstructorName}`
            : `${spanNameOrPrefix}.${argConstructorName}`;
        }
      }

      // Extract attributes from arguments
      const extractedAttributes: Record<string, string | number | boolean> = {};

      if (options.attributesFrom) {
        for (const path of options.attributesFrom) {
          // Skip constructor.name as it's used for span naming
          if (path === 'constructor.name') continue;

          const value = getNestedProperty(firstArg, path);
          if (value !== undefined && value !== null) {
            const attributeKey = path.replace(/\./g, '_');
            extractedAttributes[attributeKey] = serializeValue(value);
          }
        }
      }

      // Merge all attributes
      const allAttributes = {
        ...options.attributes,
        ...extractedAttributes,
      };

      // Execute within span
      return TracingService.withSpan(
        spanName,
        async () => {
          return originalMethod.apply(this, args);
        },
        allAttributes,
      );
    };

    return descriptor;
  };
}

/**
 * Get nested property value from an object using dot notation
 * @example getNestedProperty({ user: { id: '123' } }, 'user.id') => '123'
 */
function getNestedProperty(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Serialize a value for use as a span attribute
 * OpenTelemetry only supports string, number, boolean attributes
 */
function serializeValue(value: unknown): string | number | boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    // For objects, try to extract a meaningful string representation
    if ('toString' in value && typeof value.toString === 'function') {
      const str = value.toString();
      // Avoid generic [object Object]
      if (str !== '[object Object]') {
        return str;
      }
    }
    // Fallback to JSON
    return JSON.stringify(value);
  }

  return String(value);
}
