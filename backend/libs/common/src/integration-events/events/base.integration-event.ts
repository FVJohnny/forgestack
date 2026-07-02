import { ApplicationException } from '../../errors';
import { TracingService } from '../../tracing';

/**
 * Base interface for all integration event props.
 * All integration events should extend this for their constructor props.
 */
export interface Base_IntegrationEventProps {
  id: string;
  occurredOn: Date;
}

/**
 * Base class for all integration events.
 * Enforces common properties and provides standard serialization/deserialization.
 */
export abstract class Base_IntegrationEvent {
  readonly id: string;
  readonly occurredOn: Date;

  constructor(
    props: Base_IntegrationEventProps,
    readonly topic: string,
    readonly name: string,
    readonly version: string,
  ) {
    this.id = props.id;
    this.occurredOn = props.occurredOn;
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
