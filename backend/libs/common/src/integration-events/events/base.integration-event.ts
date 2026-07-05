import { ApplicationException } from '../../errors';
import { TracingService } from '../../tracing';

/**
 * Base interface for all integration event props.
 * All integration events should extend this for their constructor props.
 */
export interface Base_IntegrationEventProps {
  id: string;
  occurredOn: Date;
  /**
   * Optional id of the aggregate this event is about (e.g. the userId). Used as
   * the Kafka partition key so all events for the same aggregate land on one
   * partition and are consumed in order. When omitted, the publisher falls back
   * to the event's own id, which does NOT guarantee per-aggregate ordering
   * (each event may hash to a different partition). Set this on events whose
   * order relative to each other matters.
   */
  aggregateId?: string;
}

/**
 * Static routing metadata (topic/name/version) for an integration event class.
 * Each subclass declares it once; the handler decorator reads it WITHOUT
 * constructing an instance (see the note on `metadata` below).
 */
export interface IntegrationEventMetadata {
  topic: string;
  name: string;
  version: string;
}

/**
 * Base class for all integration events.
 * Enforces common properties and provides standard serialization/deserialization.
 */
export abstract class Base_IntegrationEvent {
  /**
   * Routing metadata as a STATIC so consumers (the @IntegrationEventHandler
   * decorator) can read topic/name without instantiating the event. Subclasses
   * must override this and feed it into their `super(...)` call so instance and
   * static stay in sync. The base value is a placeholder that is never routed.
   */
  static readonly metadata: IntegrationEventMetadata = {
    topic: '',
    name: '',
    version: '',
  };

  readonly id: string;
  readonly occurredOn: Date;
  readonly aggregateId?: string;

  constructor(
    props: Base_IntegrationEventProps,
    readonly topic: string,
    readonly name: string,
    readonly version: string,
  ) {
    this.id = props.id;
    this.occurredOn = props.occurredOn;
    this.aggregateId = props.aggregateId;
  }

  /**
   * Converts the event to a JSON message payload.
   *
   */
  toJSON(): Record<string, unknown> {
    const metadata = TracingService.getTraceMetadata();

    return {
      topic: this.topic,
      name: this.name,
      version: this.version,

      id: this.id,
      occurredOn: this.occurredOn.toISOString(),
      ...(this.aggregateId ? { aggregateId: this.aggregateId } : {}),
      metadata: metadata || {},
      ...this.toEventJSON(),
    };
  }

  toJSONString(): string {
    return JSON.stringify(this.toJSON());
  }

  static random(): Base_IntegrationEvent {
    throw new ApplicationException(`${this.name}.random() must be implemented by subclass`);
  }

  /**
   * Base implementation for creating events from JSON messages.
   * Subclasses should override this method.
   */
  static fromJSON(json: Record<string, unknown>): Base_IntegrationEvent {
    throw new ApplicationException(
      `${this.name}.fromJSON() must be implemented by subclass. Received: ${Object.keys(json).join(', ')}`,
    );
  }

  static validateJson(json: Record<string, unknown>): void {
    if (!json.id) throw new ApplicationException('id is required');
    if (!json.occurredOn) throw new ApplicationException('occurredOn is required');
  }

  /**
   * Validates the event before publishing.
   * Subclasses can override to add specific validation.
   */
  protected validate(): void {
    if (!this.id) throw new ApplicationException('id is required');
    if (!this.occurredOn) throw new ApplicationException('occurredOn is required');
  }

  /**
   * Subclasses must implement this to return their specific event data.
   */
  protected abstract toEventJSON(): Record<string, unknown>;
}
