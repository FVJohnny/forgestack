import { DateVO, Id, SharedAggregate, SharedAggregateDTO, Timestamps } from '../../general';
import { DomainValidationException } from '../../errors';
import {
  OutboxEventName,
  OutboxMaxRetries,
  OutboxPayload,
  OutboxProcessedAt,
  OutboxRetryCount,
  OutboxTopic,
} from './value-objects';
import { type Base_IntegrationEvent } from '../../integration-events/events/base.integration-event';

export class OutboxEventDTO extends SharedAggregateDTO {
  eventName: string;
  topic: string;
  payload: string;
  processedAt: Date;
  retryCount: number;
  maxRetries: number;

  static random(overrides: Partial<OutboxEventDTO> = {}): OutboxEventDTO {
    const entity = OutboxEvent.random({
      id: overrides.id ? new Id(overrides.id) : undefined,
      eventName: overrides.eventName ? new OutboxEventName(overrides.eventName) : undefined,
      topic: overrides.topic ? new OutboxTopic(overrides.topic) : undefined,
      payload: overrides.payload ? new OutboxPayload(overrides.payload) : undefined,
      processedAt: overrides.processedAt ? new OutboxProcessedAt(overrides.processedAt) : undefined,
      retryCount: overrides.retryCount ? new OutboxRetryCount(overrides.retryCount) : undefined,
      maxRetries: overrides.maxRetries ? new OutboxMaxRetries(overrides.maxRetries) : undefined,
    });
    return entity.toValue();
  }
}

export interface OutboxEventAttributes {
  id: Id;
  eventName: OutboxEventName;
  topic: OutboxTopic;
  payload: OutboxPayload;
  processedAt: OutboxProcessedAt;
  retryCount: OutboxRetryCount;
  maxRetries: OutboxMaxRetries;
  timestamps: Timestamps;
}

export interface CreateOutboxEventProps {
  eventName: OutboxEventName;
  topic: OutboxTopic;
  payload: OutboxPayload;
}

export class OutboxEvent extends SharedAggregate implements OutboxEventAttributes {
  static readonly NEVER_PROCESSED = OutboxProcessedAt.NEVER_PROCESSED;

  eventName: OutboxEventName;
  topic: OutboxTopic;
  payload: OutboxPayload;
  processedAt: OutboxProcessedAt;
  retryCount: OutboxRetryCount;
  maxRetries: OutboxMaxRetries;

  constructor(props: OutboxEventAttributes) {
    super(props.id, props.timestamps);
    this.eventName = props.eventName;
    this.topic = props.topic;
    this.payload = props.payload;
    this.processedAt = props.processedAt;
    this.retryCount = props.retryCount;
    this.maxRetries = props.maxRetries;
    this.ensureRetryNotExceeded();
  }

  static create<T extends Base_IntegrationEvent>(integrationEvent: T): OutboxEvent {
    return new OutboxEvent({
      id: Id.random(),
      eventName: new OutboxEventName(integrationEvent.name),
      topic: new OutboxTopic(integrationEvent.topic),
      payload: new OutboxPayload(integrationEvent.toJSONString()),
      processedAt: OutboxProcessedAt.never(),
      retryCount: OutboxRetryCount.zero(),
      maxRetries: OutboxMaxRetries.default(),
      timestamps: Timestamps.create(),
    });
  }

  static random(overrides: Partial<OutboxEventAttributes> = {}): OutboxEvent {
    const maxRetries = overrides.maxRetries ?? OutboxMaxRetries.random();

    return new OutboxEvent({
      id: overrides.id ?? Id.random(),
      eventName: overrides.eventName ?? OutboxEventName.random(),
      topic: overrides.topic ?? OutboxTopic.random(),
      payload: overrides.payload ?? OutboxPayload.random(),
      processedAt:
        overrides.processedAt ??
        (Math.random() > 0.5 ? OutboxProcessedAt.random() : OutboxProcessedAt.never()),
      retryCount: overrides.retryCount ?? OutboxRetryCount.random(maxRetries.toValue()),
      maxRetries,
      timestamps: overrides.timestamps ?? Timestamps.random(),
    });
  }

  isProcessed(): boolean {
    return this.processedAt.isProcessed();
  }

  isProcessedBefore(date: Date): boolean {
    return this.isProcessed() && this.processedAt.toValue() < date;
  }

  isUnprocessed(): boolean {
    return this.processedAt.isNeverProcessed();
  }

  canRetry(): boolean {
    return this.retryCount.isLessThan(this.maxRetries) && !this.isProcessed();
  }

  toValue(): OutboxEventDTO {
    return {
      ...super.toValue(),

      eventName: this.eventName.toValue(),
      topic: this.topic.toValue(),
      payload: this.payload.toValue(),
      processedAt: this.processedAt.toValue(),
      retryCount: this.retryCount.toValue(),
      maxRetries: this.maxRetries.toValue(),
    };
  }

  static fromValue(value: OutboxEventDTO): OutboxEvent {
    return new OutboxEvent({
      id: new Id(value.id),
      eventName: new OutboxEventName(value.eventName),
      topic: new OutboxTopic(value.topic),
      payload: new OutboxPayload(value.payload),
      processedAt: new OutboxProcessedAt(new Date(value.processedAt)),
      retryCount: new OutboxRetryCount(value.retryCount),
      maxRetries: new OutboxMaxRetries(value.maxRetries),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  markAsProcessed(): void {
    this.processedAt = OutboxProcessedAt.now();
  }

  incrementRetry(): void {
    if (!this.canRetry()) {
      throw new DomainValidationException(
        'OutboxRetryCount',
        this.retryCount.toValue(),
        'Cannot increment retry count beyond max retries',
      );
    }
    this.retryCount = this.retryCount.increment();
  }

  private ensureRetryNotExceeded(): void {
    if (this.retryCount.toValue() > this.maxRetries.toValue()) {
      throw new DomainValidationException(
        'OutboxRetryCount',
        this.retryCount.toValue(),
        'Retry count cannot exceed max retries',
      );
    }
  }
}
