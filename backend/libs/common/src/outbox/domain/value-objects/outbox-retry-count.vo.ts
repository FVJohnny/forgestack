import { ValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';
import type { OutboxMaxRetries } from './outbox-max-retries.vo';

export class OutboxRetryCount extends ValueObject<number> {
  constructor(value: number) {
    super(value);
  }

  validate(): void {
    super.validate();
    const value = this.value;
    if (!Number.isInteger(value) || value < 0) {
      throw new DomainValidationException(
        'OutboxRetryCount',
        value,
        'Retry count must be a non-negative integer',
      );
    }
  }

  static zero(): OutboxRetryCount {
    return new OutboxRetryCount(0);
  }

  static random(max: number = 5): OutboxRetryCount {
    if (max < 0) {
      throw new DomainValidationException(
        'OutboxRetryCount',
        max,
        'Random retry upper bound must be non-negative',
      );
    }
    const value = Math.floor(Math.random() * (max + 1));
    return new OutboxRetryCount(value);
  }

  increment(): OutboxRetryCount {
    return new OutboxRetryCount(this.toValue() + 1);
  }

  isLessThan(maxRetries: OutboxMaxRetries): boolean {
    return this.toValue() < maxRetries.toValue();
  }
}
