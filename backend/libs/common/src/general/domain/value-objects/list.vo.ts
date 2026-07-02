import { DomainValidationException } from '../../../errors';
import { ValueObject, type Primitives } from './base.vo';

export abstract class ListValueObject<T extends Primitives> extends ValueObject<T[]> {
  constructor(items: T[]) {
    super(items);
    this.validate();
  }

  validate(): void {
    super.validate();
    if (!Array.isArray(this.value)) {
      throw new DomainValidationException(
        this.constructor.name,
        this.value,
        'ListValueObject items must be an array',
      );
    }
    if (this.value.some((item) => item === null || item === undefined)) {
      throw new DomainValidationException(
        this.constructor.name,
        this.value,
        'ListValueObject items must not be null or undefined',
      );
    }
  }

  getItems(): T[] {
    return [...this.value];
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  size(): number {
    return this.value.length;
  }

  contains(item: T): boolean {
    return this.value.includes(item);
  }

  at(index: number): T | undefined {
    return this.value[index];
  }

  first(): T | undefined {
    return this.value[0];
  }

  last(): T | undefined {
    return this.value[this.value.length - 1];
  }

  toArray(): T[] {
    return this.getItems();
  }

  map<U>(fn: (item: T, index: number) => U): U[] {
    return this.value.map(fn);
  }

  filter(fn: (item: T, index: number) => boolean): T[] {
    return this.value.filter(fn);
  }

  some(fn: (item: T, index: number) => boolean): boolean {
    return this.value.some(fn);
  }

  every(fn: (item: T, index: number) => boolean): boolean {
    return this.value.every(fn);
  }

  find(fn: (item: T, index: number) => boolean): T | undefined {
    return this.value.find(fn);
  }
}
