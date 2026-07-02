import { Id, StringValueObject } from '../../../general';
import type { TraceMetadata } from '../../../tracing';

export class OutboxPayload extends StringValueObject {
  validate(): void {
    super.validate();
    // Why: JSON.parse on every construction was a major CPU hotspot in prod
    // (the sibling InboxPayload had the same issue at 68% of total CPU).
    // The payload is always built via fromObject (JSON.stringify of an object) or
    // rehydrated from a string that was previously stringified, so parsing here is
    // redundant. toJSON / getTraceMetadata still parse lazily when needed.
  }

  static fromObject(payload: unknown): OutboxPayload {
    return new OutboxPayload(JSON.stringify(payload));
  }

  static random(): OutboxPayload {
    return OutboxPayload.fromObject({
      id: Id.random().toValue(),
      timestamp: new Date().toISOString(),
    });
  }

  toJSON(): Record<string, unknown> {
    return JSON.parse(this.toValue());
  }

  getTraceMetadata(): TraceMetadata | undefined {
    const payload = this.toJSON() as TraceMetadata;

    return payload.traceId && payload.spanId
      ? { traceId: payload.traceId, spanId: payload.spanId }
      : undefined;
  }
}
