import { StringValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';
import type { TraceMetadata } from '../../../tracing';

export class InboxPayload extends StringValueObject {
  validate(): void {
    super.validate();
    if (!this.value) {
      throw new DomainValidationException(
        'InboxPayload',
        String(this.value),
        'InboxPayload cannot be null or undefined',
      );
    }
    // Why: a JSON.parse on every construction dominated CPU in prod (68% of total)
    // because every claim/save/handler step re-hydrates the VO. Downstream code that
    // actually needs the parsed object (toJSON, getTraceMetadata, handlers) parses
    // lazily and will throw naturally if the payload is malformed.
  }

  static random(): InboxPayload {
    const randomData = {
      id: Math.random().toString(36).substring(2, 15),
      data: `random-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    return new InboxPayload(JSON.stringify(randomData));
  }

  toJSON(): Record<string, unknown> {
    return JSON.parse(this.toValue());
  }

  getTraceMetadata(): TraceMetadata | undefined {
    const payload = this.toJSON() as { metadata?: TraceMetadata };
    const metadata = payload.metadata;

    return metadata?.traceId && metadata?.spanId
      ? { traceId: metadata.traceId, spanId: metadata.spanId }
      : undefined;
  }
}
