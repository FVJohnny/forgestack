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
    // Compare prototypes rather than constructor.name: name-based checks break
    // under minification (two different VOs can share a mangled name), while
    // prototype identity is stable.
    if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(other)) {
      return false;
    }
    return ValueObject.valuesEqual(this.value, other.value);
  }

  // Value equality across the Primitives union: Dates and structural values
  // (arrays/objects) are not reference-comparable, so compare them by content.
  // Scalars fall through to strict equality.
  private static valuesEqual(a: Primitives, b: Primitives): boolean {
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return a === b;
  }

  toString(): string {
    return this.value.toString();
  }

  toValue(): T {
    return this.value;
  }
}
