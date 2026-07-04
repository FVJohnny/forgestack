import type { IValueObject, Primitives } from '../..';

export abstract class EnumValueObject<T extends Primitives> implements IValueObject<T> {
  private readonly value: T;

  constructor(
    value: T,
    public readonly validValues: readonly T[],
  ) {
    this.value = value;
    this.validate();
  }

  public validate(): void {
    if (!this.validValues.includes(this.value)) {
      this.throwErrorForInvalidValue(this.value);
    }
  }

  protected abstract throwErrorForInvalidValue(value: T): void;

  equals(other: EnumValueObject<T>): boolean {
    return other.constructor.name === this.constructor.name && other.value === this.value;
  }

  toString(): string {
    return this.value?.toString() || '';
  }

  toValue(): T {
    return this.value;
  }
}
