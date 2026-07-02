import { DomainValidationException } from '../../../errors';
import { EnumValueObject } from '../../../general';

export enum InboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  DUPLICATE = 'duplicate',
}

export class InboxStatusVO extends EnumValueObject<InboxStatus> {
  constructor(value: InboxStatus) {
    super(value, Object.values(InboxStatus));
  }

  protected throwErrorForInvalidValue(value: InboxStatus): void {
    throw new DomainValidationException(`InboxStatus`, value, `Invalid value`);
  }

  static random(): InboxStatusVO {
    const statuses = Object.values(InboxStatus);
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    return new InboxStatusVO(randomStatus);
  }

  static pending(): InboxStatusVO {
    return new InboxStatusVO(InboxStatus.PENDING);
  }

  static processing(): InboxStatusVO {
    return new InboxStatusVO(InboxStatus.PROCESSING);
  }

  static processed(): InboxStatusVO {
    return new InboxStatusVO(InboxStatus.PROCESSED);
  }

  static failed(): InboxStatusVO {
    return new InboxStatusVO(InboxStatus.FAILED);
  }

  static duplicate(): InboxStatusVO {
    return new InboxStatusVO(InboxStatus.DUPLICATE);
  }

  isPending(): boolean {
    return this.toValue() === InboxStatus.PENDING;
  }

  isProcessing(): boolean {
    return this.toValue() === InboxStatus.PROCESSING;
  }

  isProcessed(): boolean {
    return this.toValue() === InboxStatus.PROCESSED;
  }

  isFailed(): boolean {
    return this.toValue() === InboxStatus.FAILED;
  }

  isDuplicate(): boolean {
    return this.toValue() === InboxStatus.DUPLICATE;
  }
}
