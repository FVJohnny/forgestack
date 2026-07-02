import { Id, SharedAggregate, SharedAggregateDTO } from '../../general';
import { DomainValidationException } from '../../errors';
import type { InboxStatus } from './value-objects';
import {
  InboxEventName,
  InboxTopic,
  InboxPayload,
  InboxReceivedAt,
  InboxProcessedAt,
  InboxStatusVO,
} from './value-objects';

export class InboxEventDTO extends SharedAggregateDTO {
  messageId!: string;
  eventName!: string;
  topic!: string;
  payload!: string;
  receivedAt!: Date;
  processedAt!: Date;
  status!: InboxStatus;

  static random(overrides: Partial<InboxEventDTO> = {}): InboxEventDTO {
    const entity = InboxEvent.random({
      id: overrides.id ? new Id(overrides.id) : undefined,
      eventName: overrides.eventName ? new InboxEventName(overrides.eventName) : undefined,
      topic: overrides.topic ? new InboxTopic(overrides.topic) : undefined,
      payload: overrides.payload ? new InboxPayload(overrides.payload) : undefined,
      receivedAt: overrides.receivedAt ? new InboxReceivedAt(overrides.receivedAt) : undefined,
      processedAt: overrides.processedAt ? new InboxProcessedAt(overrides.processedAt) : undefined,
      status: overrides.status ? new InboxStatusVO(overrides.status) : undefined,
    });
    return entity.toValue();
  }
}

export interface InboxEventAttributes {
  id: Id;
  eventName: InboxEventName;
  topic: InboxTopic;
  payload: InboxPayload;
  receivedAt: InboxReceivedAt;
  processedAt: InboxProcessedAt;
  status: InboxStatusVO;
}

export interface CreateInboxEventProps {
  id: Id;
  eventName: InboxEventName;
  topic: InboxTopic;
  payload: InboxPayload;
}

export class InboxEvent extends SharedAggregate implements InboxEventAttributes {
  eventName: InboxEventName;
  topic: InboxTopic;
  payload: InboxPayload;
  receivedAt: InboxReceivedAt;
  processedAt: InboxProcessedAt;
  status: InboxStatusVO;

  constructor(props: InboxEventAttributes) {
    super(props.id);
    this.eventName = props.eventName;
    this.topic = props.topic;
    this.payload = props.payload;
    this.receivedAt = props.receivedAt;
    this.processedAt = props.processedAt;
    this.status = props.status;
    this.ensureValidState();
  }

  static create(props: CreateInboxEventProps): InboxEvent {
    return new InboxEvent({
      id: props.id,
      eventName: props.eventName,
      topic: props.topic,
      payload: props.payload,
      receivedAt: InboxReceivedAt.now(),
      processedAt: InboxProcessedAt.never(),
      status: InboxStatusVO.pending(),
    });
  }

  static random(overrides: Partial<InboxEventAttributes> = {}): InboxEvent {
    return new InboxEvent({
      id: overrides.id ?? Id.random(),
      eventName: overrides.eventName ?? InboxEventName.random(),
      topic: overrides.topic ?? InboxTopic.random(),
      payload: overrides.payload ?? InboxPayload.random(),
      receivedAt: overrides.receivedAt ?? InboxReceivedAt.random(),
      processedAt:
        overrides.processedAt ??
        (Math.random() > 0.5 ? InboxProcessedAt.random() : InboxProcessedAt.never()),
      status: overrides.status ?? InboxStatusVO.random(),
    });
  }

  isProcessed(): boolean {
    return this.status.isProcessed();
  }

  isPending(): boolean {
    return this.status.isPending();
  }

  isProcessing(): boolean {
    return this.status.isProcessing();
  }

  isFailed(): boolean {
    return this.status.isFailed();
  }

  isDuplicate(): boolean {
    return this.status.isDuplicate();
  }

  canProcess(): boolean {
    return this.status.isPending();
  }

  toValue(): InboxEventDTO {
    const dto = new InboxEventDTO();
    dto.id = this.id.toValue();
    dto.eventName = this.eventName.toValue();
    dto.topic = this.topic.toValue();
    dto.payload = this.payload.toValue();
    dto.receivedAt = this.receivedAt.toValue();
    dto.processedAt = this.processedAt.toValue();
    dto.status = this.status.toValue();
    return dto;
  }

  static fromValue(value: InboxEventDTO): InboxEvent {
    return new InboxEvent({
      id: new Id(value.id),
      eventName: new InboxEventName(value.eventName),
      topic: new InboxTopic(value.topic),
      payload: new InboxPayload(value.payload),
      receivedAt: new InboxReceivedAt(new Date(value.receivedAt)),
      processedAt: new InboxProcessedAt(new Date(value.processedAt)),
      status: new InboxStatusVO(value.status),
    });
  }

  markAsProcessing(): void {
    if (!this.canProcess()) {
      throw new DomainValidationException(
        'InboxStatus',
        this.status.toValue(),
        'Cannot mark as processing: event is not in pending state',
      );
    }
    this.status = InboxStatusVO.processing();
  }

  markAsProcessed(): void {
    if (!this.isProcessing()) {
      throw new DomainValidationException(
        'InboxStatus',
        this.status.toValue(),
        'Cannot mark as processed: event is not in processing state',
      );
    }
    this.status = InboxStatusVO.processed();
    this.processedAt = InboxProcessedAt.now();
  }

  markAsFailed(): void {
    this.status = InboxStatusVO.failed();
  }

  markAsDuplicate(): void {
    this.status = InboxStatusVO.duplicate();
    this.processedAt = InboxProcessedAt.now();
  }

  private ensureValidState(): void {
    if (this.status.isProcessed() && this.processedAt.isNeverProcessed()) {
      throw new DomainValidationException(
        'InboxProcessedAt',
        this.processedAt.toValue(),
        'Processed events must have a processed timestamp',
      );
    }
  }
}
