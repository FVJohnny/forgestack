import { DomainValidationException } from '../../../errors';
import { DateVO } from './date.vo';
import type { IValueObject } from './base.vo';

interface TimestampsValue extends Record<string, unknown> {
  createdAt: Date;
  updatedAt: Date;
}

export class Timestamps implements IValueObject<TimestampsValue> {
  public readonly createdAt: DateVO;
  public readonly updatedAt: DateVO;

  constructor(createdAt: DateVO, updatedAt: DateVO) {
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.validate();
  }

  static create(): Timestamps {
    const now = new Date();
    return new Timestamps(new DateVO(now), new DateVO(now));
  }

  static random({
    createdAt,
    updatedAt,
  }: { createdAt?: DateVO; updatedAt?: DateVO } = {}): Timestamps {
    return new Timestamps(
      createdAt ?? DateVO.dateVOAtDaysFromNow(Math.floor(Math.random() * -100)),
      updatedAt ?? DateVO.dateVOAtDaysFromNow(Math.floor(Math.random() * -100)),
    );
  }

  toValue(): TimestampsValue {
    return {
      createdAt: this.createdAt.toValue(),
      updatedAt: this.updatedAt.toValue(),
    };
  }

  equals(other: Timestamps): boolean {
    if (!(other instanceof Timestamps)) {
      return false;
    }
    return this.createdAt.equals(other.createdAt) && this.updatedAt.equals(other.updatedAt);
  }

  validate(): void {
    // Allow a small clock-skew tolerance. Two reasons:
    //   1. Timestamps.create() calls `new Date()` at line 21 and then the
    //      constructor re-calls `new Date()` inside this validate(). If the
    //      host clock steps backwards between the two calls (common on
    //      Docker/macOS after laptop sleep or ntp sync), the just-created
    //      `createdAt` would appear "in the future" by a few milliseconds
    //      and crash the whole process on aggregate rehydration.
    //   2. Legitimate rehydration from a clock slightly ahead of this node's
    //      clock (distributed systems) shouldn't abort the service.
    // The rule still catches genuinely-wrong timestamps (years off, corrupted
    // payloads) which is the real intent.
    const CLOCK_SKEW_TOLERANCE_MS = 5000;
    const nowWithTolerance = Date.now() + CLOCK_SKEW_TOLERANCE_MS;

    if (this.createdAt.toValue().getTime() > nowWithTolerance) {
      throw new DomainValidationException(
        'createdAt',
        this.createdAt.toValue(),
        'Creation date cannot be in the future',
      );
    }

    if (this.updatedAt.toValue().getTime() > nowWithTolerance) {
      throw new DomainValidationException(
        'updatedAt',
        this.updatedAt.toValue(),
        'Update date cannot be in the future',
      );
    }
  }
}
