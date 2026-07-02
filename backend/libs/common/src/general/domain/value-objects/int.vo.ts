import { ValueObject } from './base.vo';

export abstract class NumberValueObject extends ValueObject<number> {
  isBiggerThan(other: NumberValueObject): boolean {
    return this.toValue() > other.toValue();
  }

  isLessThan(other: NumberValueObject): boolean {
    return this.toValue() < other.toValue();
  }

  isGreaterThanOrEqual(other: NumberValueObject): boolean {
    return this.toValue() >= other.toValue();
  }

  isLessThanOrEqual(other: NumberValueObject): boolean {
    return this.toValue() <= other.toValue();
  }

  isEqualTo(other: NumberValueObject): boolean {
    return this.toValue() === other.toValue();
  }

  isNotEqualTo(other: NumberValueObject): boolean {
    return this.toValue() !== other.toValue();
  }

  isBetween(min: NumberValueObject, max: NumberValueObject): boolean {
    return this.toValue() >= min.toValue() && this.toValue() <= max.toValue();
  }
}
