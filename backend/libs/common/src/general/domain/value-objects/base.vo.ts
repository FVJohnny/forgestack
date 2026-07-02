import { DomainValidationException } from '../../../errors';

export type Primitives =
  | string
  | number
  | boolean
  | Date
  | Record<string, unknown>
  | Array<Primitives>;

export interface IValueObject<T extends Primitives> {
  validate(): void;
  equals(other: IValueObject<T>): boolean;
  toString(): string;
  toValue(): T;
}

export abstract class ValueObject<T extends Primitives> implements IValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
    this.validate();
  }

  validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new DomainValidationException(this.constructor.name, '', 'Value must be defined');
    }
  }

  equals(other: ValueObject<T>): boolean {
    if (!(other instanceof ValueObject)) {
      return false;
    }
    return other.constructor.name === this.constructor.name && other.value === this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  toValue(): T {
    return this.value;
  }
}
