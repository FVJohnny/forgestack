import { Injectable } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode, ROOT_CONTEXT } from '@opentelemetry/api';

export type TraceMetadata = {
  traceId: string;
  spanId: string;
};

@Injectable()
export class TracingService {
  private static readonly tracer = trace.getTracer('nestjs-service');

  /**
   * Get current trace metadata (traceId and spanId) for inclusion in events/messages
   * Returns undefined if no active trace context
   */
  static getTraceMetadata(): TraceMetadata | undefined {
    const context = trace.getActiveSpan()?.spanContext();

    const traceId = context?.traceId;
    const spanId = context?.spanId;

    if (traceId && spanId) {
      return { traceId, spanId };
    }

    return undefined;
  }

  /**
   * Execute a function within a new span (auto-cleanup)
   *
   * @param name - Span name
   * @param fn - Function to execute within the span
   * @param attributes - Optional span attributes
   * @param parentContext - Optional remote parent trace context to continue the same trace
   *
   * Use cases:
   * - Background processes: call without parentContext to create independent trace
   * - Nested operations: span will be child of current active span (if exists)
   * - Integration events: provide parentContext to continue the trace from the original publisher
   *
   * Note: If parentContext is provided, the new span will be part of the same trace,
   * maintaining trace continuity across service boundaries.
   */
  static async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
    parentContext?: TraceMetadata,
  ): Promise<T> {
    let activeContext = context.active();

    // If there's a remote parent context, set it as the active context
    // This continues the same trace across service boundaries
    if (parentContext) {
      activeContext = trace.setSpanContext(activeContext, {
        traceId: parentContext.traceId,
        spanId: parentContext.spanId,
        traceFlags: 1,
      });
    }

    const span = this.tracer.startSpan(name, {}, activeContext);
    if (attributes) {
      span.setAttributes(attributes);
    }
    const ctx = trace.setSpan(activeContext, span);

    try {
      const result = await context.with(ctx, () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute a function within a completely new trace (ignoring any existing context)
   *
   * @param name - Span name
   * @param fn - Function to execute within the span
   * @param attributes - Optional span attributes
   *
   * Use this when you need to start a fresh trace that should NOT be a child of
   * any existing trace context. Common use cases:
   * - Incoming messages from external systems (e.g., message brokers, webhooks)
   * - Background jobs that should have independent traces
   * - Any entry point where you want trace isolation
   */
  static async withFreshTrace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {}, ROOT_CONTEXT);
    if (attributes) {
      span.setAttributes(attributes);
    }
    const ctx = trace.setSpan(ROOT_CONTEXT, span);

    try {
      const result = await context.with(ctx, () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add attribute to current active span
   */
  static setAttribute(key: string, value: string | number | boolean): void {
    trace.getActiveSpan()?.setAttribute(key, value);
  }

  /**
   * Add event to current active span
   */
  static addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    trace.getActiveSpan()?.addEvent(name, attributes);
  }
}
