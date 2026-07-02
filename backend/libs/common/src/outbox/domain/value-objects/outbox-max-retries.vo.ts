import { ValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';

export class OutboxMaxRetries extends ValueObject<number> {
  static readonly MAX_VALUE = 10;

  constructor(value: number) {
    super(value);
    this.validate();
  }

  validate(): void {
    super.validate();
    if (!Number.isInteger(this.value) || this.value < 1) {
      throw new DomainValidationException(
        'OutboxMaxRetries',
        this.value,
        'Max retries must be a positive integer',
      );
    }
    if (this.value > OutboxMaxRetries.MAX_VALUE) {
      throw new DomainValidationException(
        'OutboxMaxRetries',
        this.value,
        `Max retries cannot exceed ${OutboxMaxRetries.MAX_VALUE}`,
      );
    }
  }

  static default(): OutboxMaxRetries {
    return new OutboxMaxRetries(3);
  }

  static random(): OutboxMaxRetries {
    const value = Math.floor(Math.random() * OutboxMaxRetries.MAX_VALUE) + 1;
    return new OutboxMaxRetries(value);
  }
}
