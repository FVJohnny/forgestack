import { EnumValueObject } from '../../value-objects/enum.vo';
import { DomainValidationException } from '../../../../errors';

export enum Operator {
  EQUAL = '=',
  NOT_EQUAL = '!=',
  GT = '>',
  LT = '<',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  IN = 'IN',
}

export class FilterOperator extends EnumValueObject<Operator> {
  constructor(value: Operator) {
    super(value, Object.values(Operator));
  }

  protected throwErrorForInvalidValue(value: Operator): void {
    throw new DomainValidationException(`FilterOperator`, value, 'Invalid filter operator');
  }

  static fromValue(value: string): FilterOperator {
    return new FilterOperator(value as Operator);
  }

  public isPositive(): boolean {
    return this.toValue() !== Operator.NOT_EQUAL && this.toValue() !== Operator.NOT_CONTAINS;
  }

  static equal() {
    return this.fromValue(Operator.EQUAL);
  }

  static contains() {
    return this.fromValue(Operator.CONTAINS);
  }

  public is(operator: Operator): boolean {
    return this.toValue() === operator;
  }

  public isStringOperator(): boolean {
    return this.is(Operator.CONTAINS) || this.is(Operator.NOT_CONTAINS);
  }
}
